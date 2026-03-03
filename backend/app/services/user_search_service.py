from typing import List, Dict

from .user_service import user_service


class UserSearchService:
    async def search_users(self, query: str, current_user: str, limit: int = 20) -> List[Dict]:
        normalized_query = (query or "").strip().lower()
        if not normalized_query:
            return []

        users = await user_service.get_all_users()
        current_user_lower = current_user.lower()

        results: List[Dict] = []
        for user in users:
            wallet_address = str(user.get("wallet_address", "")).lower()
            username = str(user.get("username", "")).lower()

            if wallet_address == current_user_lower:
                continue

            if normalized_query in username or normalized_query in wallet_address:
                results.append(user)

            if len(results) >= limit:
                break

        return results


user_search_service = UserSearchService()
