import { z } from 'zod'

export const CHANNELS = ['youtube', 'instagram', 'facebook', 'twitter', 'pinterest', 'website'] as const
export const ChannelSchema = z.enum(CHANNELS)

const PostSchema = z.object({
  channel: ChannelSchema,
  caption: z.string().min(10),
  headline: z.string().min(3),
  hashtags: z.array(z.string()).max(12)
})

export const CampaignDraftSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(3),
  objective: z.enum(['awareness', 'education', 'conversion', 'retention']),
  audience: z.string().min(3),
  angle: z.string().min(3),
  hook: z.string().min(3),
  offer: z.string().default(''),
  callToAction: z.string().min(3),
  factualClaims: z.array(z.string()).min(1).max(8),
  prohibitedClaims: z.array(z.string()).default([]),
  videoBrief: z.object({
    durationSeconds: z.number().int().min(15).max(60),
    voiceover: z.string().min(20),
    overlayText: z.array(z.string()).min(2).max(8),
    brollQueries: z.array(z.string()).min(2).max(10)
  }),
  posts: z.array(PostSchema).length(CHANNELS.length),
  rationale: z.string().min(10)
}).superRefine((campaign, context) => {
  const supplied = new Set(campaign.posts.map(post => post.channel))
  for (const channel of CHANNELS) {
    if (!supplied.has(channel)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['posts'], message: `Missing required channel: ${channel}` })
    }
  }
  if (supplied.size !== campaign.posts.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['posts'], message: 'Each channel must appear exactly once' })
  }
})

export type CampaignDraft = z.infer<typeof CampaignDraftSchema>
export type CampaignStatus = 'pending_approval' | 'approved' | 'rejected' | 'dispatched' | 'dispatch_failed'

export type CampaignRecord = CampaignDraft & {
  id: string
  status: CampaignStatus
  createdAt: string
  updatedAt: string
  reviewerNote?: string
  dispatchRunUrl?: string
}
