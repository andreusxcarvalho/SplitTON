import aiagent

# Step 1: Set your Google Generative AI API key
aiagent.set_api_key("AIzaSyDkSnaLwAoSmNcYZ25xvoA5D6yGlG6wPe8")

# Alternative: Set via environment variable
# export GOOGLE_GENAI_API_KEY="your-api-key"
# Then you don't need to call set_api_key()

# Step 2: Define your friend list (must include "You" for the user)
friends = ["You", "Bob", "Charlie", "Diana"]


# ========== TEXT INPUT EXAMPLES ==========

print("=" * 60)
print("EXAMPLE 1: Simple text transaction")
print("=" * 60)

try:
    result = aiagent.process_transaction(
        input_type="text",
        input_data="I paid $50 for Bob and Charlie",
        possible_friends=friends
    )
    print(f"Transactions: {len(result.transactions)}")
    for txn in result.transactions:
        print(f"  {txn.from_friend} → {txn.to_friend}: ${txn.amount} ({txn.category.value}) - {txn.item}")
    print(f"Friends involved: {result.extracted_friends}")
    print()
except ValueError as e:
    print(f"Error: {e}\n")



# ========== IMAGE INPUT EXAMPLE ==========

print("=" * 60)
print("EXAMPLE 5: Image input (receipt)")
print("=" * 60)


try:
    result = aiagent.process_transaction(
        input_type="image",
        input_data=("receipt.jpeg", "I paid. Bob only ate the brownie. Split tax 50-50"),
        possible_friends=friends
    )
    print(f"Transactions: {len(result.transactions)}")
    for txn in result.transactions:
        print(f"  {txn.from_friend} → {txn.to_friend}: ${txn.amount} ({txn.category.value}) - {txn.item}")
    print(f"Friends involved: {result.extracted_friends}")
    print()
except (ValueError, FileNotFoundError) as e:
    print(f"Error: {e}\n")
