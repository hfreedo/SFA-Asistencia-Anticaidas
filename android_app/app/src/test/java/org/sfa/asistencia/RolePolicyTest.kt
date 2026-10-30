package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class RolePolicyTest {
    @Test fun residentCannotCareEvenWithSharingPermission() {
        assertEquals(PersonCapabilities(false, true), RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "resident")), listOf(PersonGrant("a", "r", true))))
    }
    @Test fun caregiverNeedsAssignmentAndSeparateSharingConsent() {
        val roles = listOf(MembershipGrant("a", "caregiver"))
        assertEquals(PersonCapabilities(false, false), RolePolicy.capabilities("a", "r", roles, emptyList()))
        assertEquals(PersonCapabilities(true, false), RolePolicy.capabilities("a", "r", roles, listOf(PersonGrant("a", "r", false))))
    }
    @Test fun administratorInAnotherSpaceCannotElevateResident() {
        val roles = listOf(MembershipGrant("a", "resident"), MembershipGrant("b", "admin"))
        assertFalse(RolePolicy.capabilities("a", "r", roles, listOf(PersonGrant("a", "r", true))).care)
        assertEquals(PersonCapabilities(true, true), RolePolicy.capabilities("b", "s", roles, emptyList()))
    }
    @Test fun unknownRevokedOrDuplicateMembershipFailsClosed() {
        assertEquals(PersonCapabilities(false, false), RolePolicy.capabilities("a", "r", emptyList(), listOf(PersonGrant("a", "r", true))))
        assertFalse(RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "unknown")), emptyList()).care)
        assertFalse(RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "admin"), MembershipGrant("a", "resident")), emptyList()).care)
    }
}
