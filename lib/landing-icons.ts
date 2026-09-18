import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Globe,
  GraduationCap,
  Heart,
  Lock,
  ScanFace,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { LANDING_ICON_KEYS, type LandingIconKey } from '@/lib/landing-content'

const ICON_MAP: Record<LandingIconKey, LucideIcon> = {
  Lock,
  BarChart3,
  BadgeCheck,
  ScanFace,
  GraduationCap,
  Sparkles,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Users,
  Award,
  Video,
  Smartphone,
  Globe,
  Heart,
}

export function resolveLandingIcon(name: string | undefined | null): LucideIcon {
  if (name && (LANDING_ICON_KEYS as readonly string[]).includes(name)) {
    return ICON_MAP[name as LandingIconKey]
  }
  return Sparkles
}
