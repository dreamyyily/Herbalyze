export const saveProfile = (data) =>
  localStorage.setItem("userProfile", JSON.stringify(data));

export const loadProfile = () => {
  const data = localStorage.getItem("userProfile");
  return data ? JSON.parse(data) : null;
};
