// Client entry point: one file per data surface re-exported here.
export { fetchDashboard, getCards, parseCards, type RapidPassCard } from "./cards";
export { getRechargeTransactions, parseRechargeTransactions } from "./transactions";
export {
  getTravelHistory,
  parseTravelHistory,
  type TravelHistoryCard,
  type TravelOperation,
} from "./travel";
export { isEmailGate, isLoginPage, changedPage, rejectedCredentials, unverifiedEmail } from "./gates";

