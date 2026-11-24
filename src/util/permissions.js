import Prisma from "../prisma.js";

/**
 * Returns the set of feature_unique_names the user is allowed under a tab
 * in the given organization. Permissions are the union across all the
 * user's valid roles in that org. A feature only counts if both the
 * tab-role mapping and the feature-tab-role mapping are valid.
 */
export const getAllowedFeaturesForUser = async (userId, orgId, tabUniqueName) => {
  if (!userId || !orgId) return new Set();

  const rows = await Prisma.feature_tab_role.findMany({
    where: {
      is_valid: true,
      feature: { is_valid: true },
      tabs_role_table: {
        is_valid: true,
        tabs: { tab_unique_name: tabUniqueName },
        roles: {
          is_valid: true,
          organization_id: orgId,
          user_roles: {
            some: {
              is_valid: true,
              user_organizations: {
                user_id: userId,
                organization_id: orgId,
                is_valid: true,
              },
            },
          },
        },
      },
    },
    select: { feature: { select: { feature_unique_name: true } } },
  });

  return new Set(rows.map((r) => r.feature.feature_unique_name));
};
