import base64
import os
from typing import List, Union, Optional
from enum import Enum
from pydantic import BaseModel, Field
from google import genai


# Global API key - can be set via set_api_key() or defaults to env variable
_API_KEY: Optional[str] = None


def set_api_key(api_key: str) -> None:
    """Set the Google Generative AI API key for the library."""
    global _API_KEY
    _API_KEY = api_key


def _get_api_key() -> str:
    """Get the API key from global variable or environment."""
    if _API_KEY:
        return _API_KEY
    
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key:
        return env_key
    
    raise ValueError(
        "API key not set. Use set_api_key('your-key') or set GEMINI_API_KEY environment variable."
    )


class CategoryEnum(Enum):
    FOOD = "Food"
    TRANSPORTATION = "Transportation"
    HOUSING = "Housing"
    UTILITIES = "Utilities"
    HEALTH = "Health"
    ENTERTAINMENT = "Entertainment"
    SHOPPING = "Shopping"
    EDUCATION = "Education"
    TRAVEL = "Travel"
    OTHER = "Other"


class TransactionInfo(BaseModel):
    from_friend: str = Field(description="The name of the friend who paid for transaction")
    to_friend: str = Field(description="The name of the friend who owes the money to the from_friend")
    item: str = Field(description="Item that was bought or sold. If not specified, leave it blank.")
    amount: float = Field(description="Amount of the transaction in $")
    category: CategoryEnum = Field(description="Category of the item. If not specified, use OTHER.")


class ParsedTransactions(BaseModel):
    transactions: List[TransactionInfo]
    extracted_friends: List[str]


def _preprocess_input(text: str) -> str:
    """Replace first-person pronouns with 'You' for consistency."""
    import re
    # Replace common first-person pronouns (case-insensitive)
    text = re.sub(r'\bi\b', 'You', text, flags=re.IGNORECASE)
    text = re.sub(r'\bme\b', 'You', text, flags=re.IGNORECASE)
    text = re.sub(r'\bmyself\b', 'You', text, flags=re.IGNORECASE)
    text = re.sub(r'\bmy\b', 'Your', text, flags=re.IGNORECASE)
    return text


def _validate_friends(extracted_friends: List[str], possible_friends: List[str]) -> None:
    """Validate that extracted friends are from the allowed list."""
    invalid_friends = set(extracted_friends) - set(possible_friends)
    if invalid_friends:
        raise ValueError(
            f"Invalid friends detected: {invalid_friends}. Must be from: {possible_friends}"
        )
    if not extracted_friends:
        raise ValueError("No valid friends extracted from input. Please provide transaction with valid friends.")


def parse_text_input(
    text: str, possible_friends: List[str]
) -> ParsedTransactions:
    """
    Parse transaction from text input with self-perspective (first-person pronouns).
    
    Args:
        text: Transaction description text (e.g., "I paid $100 for Bob and Charlie")
        possible_friends: List of all possible friend names to validate against
        
    Returns:
        ParsedTransactions containing transactions and extracted friends
    """
    if not text or not text.strip():
        raise ValueError("Text input cannot be empty")
    
    # Preprocess: replace pronouns with "You"
    processed_text = _preprocess_input(text)
    
    client = genai.Client(api_key=_get_api_key())
    
    friends_str = ", ".join(possible_friends)
    prompt = f"""Extract all transactions from this text (written from the user's perspective): "{processed_text}"

TRANSACTION LOGIC:
- "You paid $X for person Y" → Transaction: from_friend="You", to_friend="person Y", amount=$X
- "You paid $X for Y and Z and yourself" → Split equally: each person pays (X / number_of_people). Create transactions for each person who owes You.
- "Person X paid for You" → Transaction: from_friend="person X", to_friend="You", amount=$X

SETTLEMENT/REPAYMENT LOGIC:
- "Person X paid me back $Y" or "Person X settled $Y" → This is a payment/settlement. Reduce what person X owes You by $Y.
- Calculate NET amounts: ONLY net transactions within the SAME CATEGORY between the same two people.
- Example: If "You paid $100 for Bob (FOOD)" and "Bob paid $20 for You (FOOD)", net to "You → Bob: $80 (FOOD)"
- BUT: If "You paid $100 for Bob (FOOD)" and "Bob paid $20 for You (SHOPPING)", keep BOTH separate - DO NOT MIX CATEGORIES.
- Only include final net transactions (after all settlements in same category are accounted for).

CRITICAL RULES:
1. Only use names from this exact list: {friends_str}
2. "You" represents the user in the friends list
3. For group expenses (multiple people), split the total amount equally and create separate transaction entries
4. Process settlements/refunds and calculate final NET amounts owed WITHIN SAME CATEGORY ONLY
5. NEVER mix different categories - keep them separate
6. Extract all friends mentioned (must be from the provided list)

Return a JSON with:
- transactions: list of all FINAL individual transactions (after netting within same category, but keeping different categories separate)
- extracted_friends: list of all unique friends mentioned (including "You")

If no transactions can be extracted, return empty lists."""
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": ParsedTransactions,
        },
    )
    
    result = ParsedTransactions.model_validate_json(response.text)
    _validate_friends(result.extracted_friends, possible_friends)
    
    return result


def parse_image_input(
    image_path: str, caption: str, possible_friends: List[str]
) -> ParsedTransactions:
    """
    Parse transaction from image (receipt/payment proof) with mandatory caption and self-perspective.
    
    Args:
        image_path: Path to the image file
        caption: Mandatory description/context for the image (e.g., "Dinner bill, I paid for Bob and me")
        possible_friends: List of all possible friend names to validate against
        
    Returns:
        ParsedTransactions containing transactions and extracted friends
    """
    if not caption or not caption.strip():
        raise ValueError("Caption is compulsory for image input")
    
    # Preprocess: replace pronouns with "You"
    processed_caption = _preprocess_input(caption)
    
    # Read and encode image
    try:
        with open(image_path, "rb") as img_file:
            image_data = base64.standard_b64encode(img_file.read()).decode("utf-8")
    except FileNotFoundError:
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Determine MIME type
    mime_type = "image/jpeg"
    if image_path.lower().endswith(".png"):
        mime_type = "image/png"
    elif image_path.lower().endswith(".gif"):
        mime_type = "image/gif"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"
    
    client = genai.Client(api_key=_get_api_key())
    
    friends_str = ", ".join(possible_friends)
    prompt = f"""Analyze this receipt/payment proof image with the following caption (written from user's perspective): "{processed_caption}"

Extract all transactions mentioned in the image and caption.

TRANSACTION LOGIC:
- "You paid $X for person Y" → Transaction: from_friend="You", to_friend="person Y", amount=$X
- "You paid $X for Y and Z and yourself" → Split equally: each person pays (X / number_of_people). Create transactions for each person who owes You.
- "Person X paid for You" → Transaction: from_friend="person X", to_friend="You", amount=$X

SETTLEMENT/REPAYMENT LOGIC:
- "Person X paid me back $Y" or "Person X settled $Y" → This is a payment/settlement. Reduce what person X owes You by $Y.
- Calculate NET amounts: ONLY net transactions within the SAME CATEGORY between the same two people.
- Example: If "You paid $100 for Bob (FOOD)" and "Bob paid $20 for You (FOOD)", net to "You → Bob: $80 (FOOD)"
- BUT: If "You paid $100 for Bob (FOOD)" and "Bob paid $20 for You (SHOPPING)", keep BOTH separate - DO NOT MIX CATEGORIES.
- Only include final net transactions (after all settlements in same category are accounted for).

CRITICAL RULES:
1. Only use names from this exact list: {friends_str}
2. "You" represents the user in the friends list
3. For group expenses (multiple people), split the total amount equally and create separate transaction entries
4. Process settlements/refunds and calculate final NET amounts owed WITHIN SAME CATEGORY ONLY
5. NEVER mix different categories - keep them separate
6. Extract all friends mentioned (must be from the provided list)

Return a JSON with:
- transactions: list of all FINAL individual transactions (after netting within same category, but keeping different categories separate)
- extracted_friends: list of all unique friends mentioned (including "You")

If no transactions can be extracted, return empty lists."""
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {"text": prompt},
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": image_data,
                }
            }
        ],
        config={
            "response_mime_type": "application/json",
            "response_schema": ParsedTransactions,
        },
    )
    
    result = ParsedTransactions.model_validate_json(response.text)
    _validate_friends(result.extracted_friends, possible_friends)
    
    return result


def process_transaction(
    input_type: str, 
    input_data: Union[str, tuple], 
    possible_friends: List[str]
) -> ParsedTransactions:
    """
    Main function to process transactions from self-perspective (first-person).
    
    Args:
        input_type: Either "text" or "image"
        input_data: 
            - If "text": string containing transaction description (e.g., "I paid $50 for Bob")
            - If "image": tuple of (image_path, caption) where caption is from user's perspective
        possible_friends: List of all possible friend names (should include "You" or the user's name)
        
    Returns:
        ParsedTransactions object with transactions and extracted friends
        
    Raises:
        ValueError: If invalid input or validation fails
    """
    if input_type == "text":
        if not isinstance(input_data, str):
            raise ValueError("For text input, input_data must be a string")
        return parse_text_input(input_data, possible_friends)
    
    elif input_type == "image":
        if not isinstance(input_data, tuple) or len(input_data) != 2:
            raise ValueError("For image input, input_data must be a tuple of (image_path, caption)")
        image_path, caption = input_data
        return parse_image_input(image_path, caption, possible_friends)
    
    else:
        raise ValueError(f"Invalid input_type: '{input_type}'. Must be 'text' or 'image'")


# Export public API
__all__ = [
    "CategoryEnum",
    "TransactionInfo", 
    "ParsedTransactions",
    "set_api_key",
    "process_transaction",
    "parse_text_input",
    "parse_image_input",
]
