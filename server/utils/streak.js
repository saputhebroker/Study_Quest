import { shiftDay } from "./dates.js";

export default function applyStreak(user, localDate) {
  if (user.lastActiveDate === localDate) return;
  user.streak =
    user.lastActiveDate === shiftDay(localDate, -1) ? user.streak + 1 : 1;
  user.lastActiveDate = localDate;
}