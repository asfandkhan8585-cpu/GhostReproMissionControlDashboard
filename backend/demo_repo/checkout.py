"""Sample checkout module used for local testing of GhostRepro bot."""


class ShoppingCart:
    """A minimal shopping cart for demo purposes."""

    def __init__(self):
        self.items = []

    def add_item(self, name: str, price: float, quantity: int = 1):
        """Add an item to the cart."""
        self.items.append({
            "name": name,
            "price": price,
            "quantity": quantity,
        })

    def remove_item(self, name: str):
        """Remove an item from the cart by name."""
        self.items = [item for item in self.items if item["name"] != name]

    def get_total(self) -> float:
        """Calculate the total price of all items in the cart."""
        return sum(item["price"] * item["quantity"] for item in self.items)

    def apply_discount(self, percentage: float) -> float:
        """Apply a percentage discount and return the new total."""
        if not 0 <= percentage <= 100:
            raise ValueError("Discount percentage must be between 0 and 100.")
        total = self.get_total()
        return total * (1 - percentage / 100)

    def item_count(self) -> int:
        """Return the total number of items (accounting for quantity)."""
        return sum(item["quantity"] for item in self.items)
