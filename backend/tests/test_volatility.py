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
