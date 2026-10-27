"""Hand-checkable cases for the historical adverse-move range."""
import pytest

from backend.volatility import (adverse_moves, adverse_ranges, atr_percent_series,
                                lot_from_budget, percentile, volatility_percentile)


def bar(i, high, low, close):
    return dict(time=1_700_000_000 + i * 300, high=high, low=low, close=close)


def test_percentile_is_nearest_rank_and_reproducible_by_hand():
    values = list(range(1, 21))  # 1..20
    assert percentile(values, 50) == 10   # ceil(0.50 * 20) = 10th
    assert percentile(values, 95) == 19   # ceil(0.95 * 20) = 19th
    assert percentile(values, 100) == 20
    assert percentile([7], 95) == 7
    with pytest.raises(ValueError):
        percentile([], 50)
    with pytest.raises(ValueError):
        percentile([1], 0)


def test_buy_adverse_move_is_worst_low_inside_window_as_percent_of_reference_close():
    # reference close 100; next three lows 99, 98, 99.5 -> worst 98 -> 2%
    bars = [bar(0, 101, 99, 100), bar(1, 100, 99, 99.5), bar(2, 99.5, 98, 98.5), bar(3, 100, 99.5, 100)]
    assert adverse_moves(bars, 'BUY', 3) == [pytest.approx(2.0)]


def test_sell_adverse_move_is_worst_high_inside_window():
    bars = [bar(0, 101, 99, 100), bar(1, 101, 100, 100.5), bar(2, 103, 100, 102), bar(3, 102, 101, 101.5)]
    assert adverse_moves(bars, 'SELL', 3) == [pytest.approx(3.0)]  # high 103 vs ref 100


def test_move_in_favour_is_zero_never_negative():
    bars = [bar(0, 100, 100, 100), bar(1, 105, 101, 104), bar(2, 106, 104, 105)]
    assert adverse_moves(bars, 'BUY', 2) == [0.0]


def test_window_across_a_missing_bar_is_skipped_not_stitched():
    bars = [bar(0, 101, 99, 100), bar(1, 100, 99, 99.5), bar(3, 100, 90, 95), bar(4, 96, 94, 95)]
    # bar index 2 is missing, so no 2-bar window starting at the first bar is valid
    assert adverse_moves(bars, 'BUY', 2) == []


def test_unknown_side_and_bad_horizon_are_rejected():
    with pytest.raises(ValueError):
        adverse_moves([], 'LONG', 3)
    with pytest.raises(ValueError):
        adverse_moves([], 'BUY', 0)


def test_ranges_report_insufficient_instead_of_inventing_a_number():
    result = adverse_ranges([bar(0, 101, 99, 100), bar(1, 100, 99, 99.5)])
    assert result['BUY']['4h'] == dict(status='INSUFFICIENT', windows=0)
    assert result['BUY']['15m']['status'] == 'INSUFFICIENT'


def test_ranges_p95_never_below_p50():
    bars = [bar(i, 100 + (i % 7) * .1, 100 - (i % 5) * .2, 100) for i in range(300)]
    for side in ('BUY', 'SELL'):
        r = adverse_ranges(bars)[side]['1h']
        assert r['status'] == 'AVAILABLE' and r['p95_pct'] >= r['p50_pct'] >= 0


def test_volatility_percentile_needs_enough_history():
    bars = [bar(i, 100.1, 99.9, 100) for i in range(30)]
    assert volatility_percentile(bars)['status'] == 'INSUFFICIENT'


def test_latest_reading_ranks_against_earlier_values_only():
    calm = [bar(i, 100.1, 99.9, 100) for i in range(120)]
    spike = calm + [bar(120 + i, 101, 99, 100) for i in range(14)]  # ATR jumps at the end
    assert volatility_percentile(spike)['rank'] == 100.0
    quiet_end = [bar(i, 101, 99, 100) for i in range(120)] + [bar(120 + i, 100.01, 99.99, 100) for i in range(14)]
    assert volatility_percentile(quiet_end)['rank'] < 15


def test_atr_series_skips_windows_that_contain_a_gap():
    bars = [bar(i, 100.1, 99.9, 100) for i in range(40)]
    gapped = bars[:20] + bars[21:]  # one missing bar
    full = len(atr_percent_series(bars))
    assert len(atr_percent_series(gapped)) < full


# --- budget to lot size -------------------------------------------------------

def test_budget_exactly_equal_to_loss_at_a_lot_size_is_allowed():
    # 3 USD/oz * 100 oz = 300 USD per lot; budget 600 -> exactly 2 lots, loss equals budget
    r = lot_from_budget('600', '3')
    assert r['status'] == 'AVAILABLE' and r['lot'] == '2' and r['loss_at_lot'] == '600.00'


def test_budget_floors_to_the_lot_step_and_never_exceeds_the_budget():
    r = lot_from_budget('1000', '3')  # 3.333... lots -> 3.33
    assert r['lot'] == '3.33' and r['loss_at_lot'] == '999.00'
    assert float(r['loss_at_lot']) <= 1000


def test_budget_too_small_for_the_minimum_lot_is_reported():
    r = lot_from_budget('2.99', '3')  # min lot 0.01 would lose 3.00 > 2.99
    assert r['status'] == 'BELOW_MINIMUM' and r['lot'] is None and r['loss_at_min_lot'] == '3.00'
    assert lot_from_budget('3.00', '3')['lot'] == '0.01'  # boundary: equal is allowed


def test_budget_is_capped_at_the_maximum_lot_and_says_so():
    r = lot_from_budget('1000000', '1')
    assert r['lot'] == '100' and r['capped'] is True


@pytest.mark.parametrize('budget,per_oz', [('0', '3'), ('-5', '3'), ('abc', '3'), ('100', '0'), ('nan', '3'), ('inf', '3')])
def test_budget_rejects_non_positive_or_non_finite_input(budget, per_oz):
    assert lot_from_budget(budget, per_oz)['status'] == 'INVALID'


# --- stop distance inside the distribution ------------------------------------

from backend.volatility import load_snapshot, touch_share, volatility_fact  # noqa: E402

GRID = [round(k / 100, 4) for k in range(1, 101)]  # 0.01 .. 1.00 percent


def test_touch_share_counts_grid_points_at_or_above_the_stop():
    assert touch_share(GRID, 0.505) == 50      # 0.51 .. 1.00
    assert touch_share(GRID, 0.50) == 51       # equal counts as touched: 0.50 .. 1.00
    assert touch_share(GRID, 0.001) == 100
    assert touch_share(GRID, 2.0) == 0


def test_touch_share_rejects_bad_input():
    with pytest.raises(ValueError):
        touch_share(GRID[:50], 0.5)
    with pytest.raises(ValueError):
        touch_share(GRID, 0)
    with pytest.raises(ValueError):
        touch_share(GRID, -1)


def test_ranges_carry_a_consistent_full_grid():
    bars = [bar(i, 100 + (i % 7) * .1, 100 - (i % 5) * .2, 100) for i in range(400)]
    r = adverse_ranges(bars)['BUY']['1h']
    q = r['quantiles_pct']
    assert len(q) == 100 and all(a <= b for a, b in zip(q, q[1:]))
    assert q[94] == r['p95_pct'] and q[49] == r['p50_pct']


def fake_snapshot():
    entry = dict(status='AVAILABLE', windows=1000, p50_pct=0.2, p95_pct=0.5, quantiles_pct=GRID)
    other = dict(entry, p95_pct=0.8)
    return dict(source='測試來源', generated_at='2026-10-28T00:00:00+00:00', window=dict(trading_days=20),
                ranges=dict(BUY={'15m': entry, '1h': entry, '4h': entry}, SELL={'15m': other, '1h': other, '4h': other}))


def test_fact_without_a_stop_states_the_range_and_no_stop_claim():
    f = volatility_fact(dict(side='BUY', price='4000', lot='0.10', sl=None), fake_snapshot())
    assert f['data']['p95_usd_per_oz'] == '20.00' and f['data']['p95_this_order_usd'] == '200.00'
    assert '不超過 20.00 美元／盎司（本筆約 200.00 美元）' in f['text']
    assert '停損' not in f['text'] and 'stop_touch_share_pct' not in f['data']


def test_fact_with_a_stop_reports_how_often_that_distance_was_reached():
    f = volatility_fact(dict(side='BUY', price='4000', lot='0.10', sl='3980'), fake_snapshot())  # 20 USD = 0.5%
    assert f['data']['stop_distance_usd_per_oz'] == '20.00'
    assert f['data']['stop_touch_share_pct'] == {'15m': 51, '1h': 51, '4h': 51}
    assert '約有 51% 的時間價格會走到這個距離' in f['text']


def test_fact_uses_the_matching_side_and_never_claims_a_loss_limit():
    sell = volatility_fact(dict(side='SELL', price='4000', lot='1', sl=None), fake_snapshot())
    assert sell['data']['p95_usd_per_oz'] == '32.00'
    for f in (sell, volatility_fact(dict(side='BUY', price='4000', lot='1', sl='3900'), fake_snapshot())):
        assert '最大損失' not in f['text'] and '不是預測' in f['text']


@pytest.mark.parametrize('draft', [dict(side='BUY', price='abc', lot='1'), dict(side='BUY', price='0', lot='1'),
                                   dict(side='BUY', price='4000', lot='-1'), dict(side='HOLD', price='4000', lot='1'),
                                   dict(price='4000', lot='1')])
def test_fact_is_omitted_when_the_draft_cannot_be_computed(draft):
    assert volatility_fact(draft, fake_snapshot()) is None


def test_fact_is_omitted_when_the_snapshot_is_missing_or_a_horizon_is_unavailable(tmp_path):
    assert load_snapshot(tmp_path / 'nope.json') is None
    snap = fake_snapshot()
    snap['ranges']['BUY']['1h'] = dict(status='INSUFFICIENT', windows=0)
    assert volatility_fact(dict(side='BUY', price='4000', lot='1'), snap) is None


def test_the_bundled_snapshot_produces_a_fact():
    f = volatility_fact(dict(side='BUY', price='4000', lot='0.10', sl='3900'))
    assert f is not None and f['data']['stop_touch_share_pct']['4h'] >= f['data']['stop_touch_share_pct']['15m']
