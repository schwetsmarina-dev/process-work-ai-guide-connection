import provider from "@/services/provider/base44Provider";

const appUsers = provider.entity("AppUser");

export const usersService = {
  getCurrentUser: () => provider.auth.getCurrentUser(),

  async getAppUserByEmail(email) {
    if (!email) return null;
    const rows = await appUsers.filter({ email });
    return rows?.[0] || null;
  },

  async getCurrentAppUser() {
    const user = await provider.auth.getCurrentUser();
    if (!user?.email) return { user, appUser: null };
    const appUser = await this.getAppUserByEmail(user.email);
    return { user, appUser };
  },

  updateAppUser: (id, payload) => appUsers.update(id, payload),
};

export default usersService;
