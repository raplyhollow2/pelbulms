/**
 * Client-safe capability keys. Do not import server modules from this file.
 */

export type CapabilityKey = string

export type CapabilityAction =
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'configure'
  | 'uninstall'

export type CapabilityGroup = 'menu' | 'module'

/** Stable keys used by APIs and the permissions UI. */
export const CAP = {
  LEARN_DASHBOARD_VIEW: 'menu.learn.dashboard.view',
  LEARN_COURSES_VIEW: 'menu.learn.courses.view',
  LEARN_PROGRESS_VIEW: 'menu.learn.progress.view',
  LEARN_REPORTS_VIEW: 'menu.learn.reports.view',
  LEARN_ANNOUNCEMENTS_VIEW: 'menu.learn.announcements.view',
  LEARN_PROFILE_VIEW: 'menu.learn.profile.view',
  LEARN_SETTINGS_VIEW: 'menu.learn.settings.view',

  TEACH_DASHBOARD_VIEW: 'menu.teach.dashboard.view',
  TEACH_CREATE_VIEW: 'menu.teach.create.view',
  TEACH_MEDIA_VIEW: 'menu.teach.media.view',
  TEACH_REPORTS_VIEW: 'menu.teach.reports.view',
  TEACH_ANNOUNCEMENTS_VIEW: 'menu.teach.announcements.view',

  DASHBOARD_VIEW: 'admin.dashboard.view',
  USERS_VIEW: 'admin.users.view',
  USERS_ADD: 'admin.users.add',
  USERS_EDIT: 'admin.users.edit',
  USERS_DELETE: 'admin.users.delete',
  APPROVALS_VIEW: 'admin.approvals.view',
  APPROVALS_EDIT: 'admin.approvals.edit',
  REVIEWERS_VIEW: 'admin.reviewers.view',
  REVIEWERS_ADD: 'admin.reviewers.add',
  REVIEWERS_EDIT: 'admin.reviewers.edit',
  REVIEWERS_DELETE: 'admin.reviewers.delete',
  REPORTS_VIEW: 'admin.reports.view',
  INSTITUTIONS_VIEW: 'admin.institutions.view',
  INSTITUTIONS_ADD: 'admin.institutions.add',
  INSTITUTIONS_EDIT: 'admin.institutions.edit',
  INSTITUTIONS_DELETE: 'admin.institutions.delete',
  SETTINGS_VIEW: 'admin.settings.view',
  SETTINGS_EDIT: 'admin.settings.edit',
  PERMISSIONS_VIEW: 'admin.permissions.view',
  PERMISSIONS_EDIT: 'admin.permissions.edit',
  AI_VIEW: 'admin.ai.view',
  AI_CONFIGURE: 'admin.ai.configure',

  MODULE_CERTIFICATES_VIEW: 'module.certificates.view',
  MODULE_CERTIFICATES_CONFIGURE: 'module.certificates.configure',
  MODULE_FORUMS_VIEW: 'module.forums.view',
  MODULE_FORUMS_CONFIGURE: 'module.forums.configure',
  MODULE_QUIZZES_VIEW: 'module.quizzes.view',
  MODULE_QUIZZES_CONFIGURE: 'module.quizzes.configure',
  MODULE_FLASHCARDS_VIEW: 'module.flashcards.view',
  MODULE_FLASHCARDS_CONFIGURE: 'module.flashcards.configure',
  MODULE_SCORM_VIEW: 'module.scorm.view',
  MODULE_SCORM_CONFIGURE: 'module.scorm.configure',
  MODULE_INTERVENTIONS_VIEW: 'module.interventions.view',
  MODULE_INTERVENTIONS_CONFIGURE: 'module.interventions.configure',
  MODULE_ANNOUNCEMENTS_VIEW: 'module.announcements.view',
  MODULE_ANNOUNCEMENTS_CONFIGURE: 'module.announcements.configure',
  MODULE_REGISTRATION_KYC_VIEW: 'module.registration_kyc.view',
  MODULE_REGISTRATION_KYC_CONFIGURE: 'module.registration_kyc.configure',
  MODULE_PLATFORM_AI_VIEW: 'module.platform_ai.view',
  MODULE_PLATFORM_AI_CONFIGURE: 'module.platform_ai.configure',
} as const
