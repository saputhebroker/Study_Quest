export default function publicUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    xp: u.xp,
    streak: u.streak,
    lastActiveDate: u.lastActiveDate,
  };
}