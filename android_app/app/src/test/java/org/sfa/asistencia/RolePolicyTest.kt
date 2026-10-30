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
        assertEquals(PersonCapabilities(true, false, true), RolePolicy.capabilities("b", "s", roles, emptyList()))
    }
    @Test fun unknownRevokedOrDuplicateMembershipFailsClosed() {
        assertEquals(PersonCapabilities(false, false), RolePolicy.capabilities("a", "r", emptyList(), listOf(PersonGrant("a", "r", true))))
        assertFalse(RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "unknown")), emptyList()).care)
        assertFalse(RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "admin"), MembershipGrant("a", "resident")), emptyList()).care)
    }
    @Test fun administratorCannotEmitEvenWithAnExplicitSharingGrant() {
        val capability = RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "admin")), listOf(PersonGrant("a", "r", true)))
        assertTrue(capability.care); assertTrue(capability.adminTest); assertFalse(capability.emit)
    }
    @Test fun homeReflectsRoleRatherThanAlwaysOpeningSharing() {
        assertEquals(1, RolePolicy.homeTab(listOf(PersonCapabilities(true, false, true))))
        assertEquals(1, RolePolicy.homeTab(listOf(PersonCapabilities(true, true))))
        assertEquals(0, RolePolicy.homeTab(listOf(PersonCapabilities(false, true))))
        assertEquals(1, RolePolicy.homeTab(emptyList()))
    }
    @Test fun testPermissionCannotBeInheritedFromAnotherSpace() {
        val capability = RolePolicy.capabilities("a", "r", listOf(MembershipGrant("a", "resident"), MembershipGrant("b", "admin")), listOf(PersonGrant("a", "r", true)))
        assertFalse(capability.adminTest); assertTrue(capability.emit)
    }
}
