package org.sfa.asistencia

data class MembershipGrant(val space: String, val role: String)
data class PersonGrant(val space: String, val resident: String, val share: Boolean)
data class PersonCapabilities(val care: Boolean, val emit: Boolean, val adminTest: Boolean = false)

object RolePolicy {
    fun capabilities(space: String, resident: String, memberships: List<MembershipGrant>, grants: List<PersonGrant>): PersonCapabilities {
        val role = memberships.singleOrNull { it.space == space }?.role
        val grant = grants.singleOrNull { it.space == space && it.resident == resident }
        return PersonCapabilities(
            care = role == "admin" || role == "caregiver" && grant != null,
            emit = role in setOf("caregiver", "resident") && grant?.share == true,
            adminTest = role == "admin",
        )
    }
    fun homeTab(capabilities: Collection<PersonCapabilities>): Int = if (capabilities.any { it.care }) 1 else if (capabilities.any { it.emit }) 0 else 1
}
