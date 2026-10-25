"""Tests for the demo checkout module."""
import pytest
from checkout import ShoppingCart


@pytest.fixture
def cart():
    return ShoppingCart()


def test_add_item(cart):
    cart.add_item("Widget", 9.99, 2)
    assert len(cart.items) == 1
    assert cart.items[0]["name"] == "Widget"


def test_remove_item(cart):
    cart.add_item("Widget", 9.99)
    cart.add_item("Gadget", 14.99)
    cart.remove_item("Widget")
    assert len(cart.items) == 1
    assert cart.items[0]["name"] == "Gadget"


def test_get_total(cart):
    cart.add_item("Widget", 10.00, 3)
    cart.add_item("Gadget", 5.00, 2)
    assert cart.get_total() == 40.00


def test_apply_discount(cart):
    cart.add_item("Widget", 100.00)
    assert cart.apply_discount(25) == 75.00


def test_apply_invalid_discount(cart):
    cart.add_item("Widget", 100.00)
    with pytest.raises(ValueError):
        cart.apply_discount(150)


def test_item_count(cart):
    cart.add_item("Widget", 10.00, 3)
    cart.add_item("Gadget", 5.00, 2)
    assert cart.item_count() == 5
