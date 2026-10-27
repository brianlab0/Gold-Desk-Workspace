"""The volatility fact reaches the explanation catalog, and only as selectable program text."""
import json
from decimal import Decimal

from backend import assistant, evidence
from backend.tests.test_assistant_context import synthetic_engine


def build(monkeypatch, with_stop=False, with_draft=True):
    engine = synthetic_engine(monkeypatch)
    draft = None
    if with_draft:
        sl = str(Decimal(engine.quote()['ask']) - 10) if with_stop else None
        draft = engine.create_draft('BUY', '0.10', sl, None)
    return evidence.build_catalog(assistant.build_context(engine, draft=draft))


def risk_facts(catalog):
    return {f['id']: f for f in catalog['sections']['risk']['facts']}


def test_catalog_lists_the_fact_as_a_default_but_not_mandatory(monkeypatch):
    catalog = build(monkeypatch)
    section = catalog['sections']['risk']
    assert 'risk.volatility' in risk_facts(catalog)
    assert 'risk.volatility' in section['defaults']
    assert 'risk.volatility' not in section['mandatory']
    assert risk_facts(catalog)['risk.volatility']['source'] == '近期歷史波動快照'


def test_no_draft_means_no_volatility_fact(monkeypatch):
    assert 'risk.volatility' not in risk_facts(build(monkeypatch, with_draft=False))


def test_fact_mentions_the_stop_only_when_a_stop_exists(monkeypatch):
    plain = risk_facts(build(monkeypatch))['risk.volatility']
    stopped = risk_facts(build(monkeypatch, with_stop=True))['risk.volatility']
    assert '你設定的停損' not in plain['text'] and 'stop_touch_share_pct' not in plain['evidence']
    assert '你設定的停損離進場價 10.00 美元／盎司' in stopped['text']
    assert set(stopped['evidence']['stop_touch_share_pct']) == {'15m', '1h', '4h'}


def test_a_valid_model_selection_can_include_it_and_the_card_renders_the_program_text(monkeypatch):
    catalog = build(monkeypatch)
    selection = {k: v['defaults'] for k, v in catalog['sections'].items()}
    card = evidence.render_card(catalog, json.dumps(selection), 'ok', 'test-model')
    assert card['status'] == 'ok'
    risk = next(s for s in card['sections'] if s['id'] == 'risk')
    fact = next(f for f in risk['facts'] if f['id'] == 'risk.volatility')
    assert fact['text'] == risk_facts(catalog)['risk.volatility']['text']   # model cannot reword it


def test_dropping_it_from_a_selection_is_allowed_because_it_is_not_mandatory(monkeypatch):
    catalog = build(monkeypatch)
    selection = {k: [i for i in v['defaults'] if i != 'risk.volatility'] for k, v in catalog['sections'].items()}
    card = evidence.render_card(catalog, json.dumps(selection), 'ok', 'test-model')
    assert card['status'] == 'ok'
    ids = [f['id'] for s in card['sections'] if s['id'] == 'risk' for f in s['facts']]
    assert 'risk.volatility' not in ids


def test_the_fact_never_uses_words_reserved_for_a_real_loss_limit(monkeypatch):
    for stop in (False, True):
        text = risk_facts(build(monkeypatch, with_stop=stop))['risk.volatility']['text']
        assert '最大損失' not in text and '不是預測' in text and '不是損失上限' in text
