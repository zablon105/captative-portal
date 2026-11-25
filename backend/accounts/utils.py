import re


def normalize_phone(raw: str) -> str:
    """Convert common Kenyan formats to 2547XXXXXXXX / 2541XXXXXXXX."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in "71":
        digits = "254" + digits
    if not (digits.startswith("254") and len(digits) == 12):
        raise ValueError("Enter a valid phone number, e.g. 0712345678")
    return digits
