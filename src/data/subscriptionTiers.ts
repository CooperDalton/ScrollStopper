import { env } from "./env/server"

export type TierNames = keyof typeof subscriptionTiers
export type PaidTierNames = Exclude<TierNames, "Free">

export const subscriptionTiers = {
  Free: {
    name: "Free",
    priceInCents: 0,
    maxNumberOfSlideshows: 3,
    maxNumberOfAIGenerations: 2,
    stripePriceId: null,
  },
  Pro: {
    name: "Pro",
    priceInCents: 1800,
    maxNumberOfSlideshows: 50,
    maxNumberOfAIGenerations: 20,
    stripePriceId: env.STRIPE_PRO_PLAN_STRIPE_PRICE_ID,
  },
} as const

export const subscriptionTiersInOrder = [
  subscriptionTiers.Free,
  subscriptionTiers.Pro,
] as const

export function getTierByPriceId(stripePriceId: string) {
  return Object.values(subscriptionTiers).find(
    tier => tier.stripePriceId === stripePriceId
  )
}
