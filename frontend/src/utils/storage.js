export const saveProfile = (data) => {
  const wallet = localStorage.getItem("user_wallet");
  if (!wallet) return;

  localStorage.setItem(`userProfile_${wallet}`, JSON.stringify(data));
};

export const loadProfile = () => {
  const wallet = localStorage.getItem("user_wallet");
  if (!wallet) return null;

  const data = localStorage.getItem(`userProfile_${wallet}`);
  return data ? JSON.parse(data) : null;
};

export const clearProfile = () => {
  const wallet = localStorage.getItem("user_wallet");
  if (!wallet) return;

  localStorage.removeItem(`userProfile_${wallet}`);
};