# BigScore Admin Panel — Complete Specification Document

**Version:** 1.1  
**Last Updated:** 2025  
**Panel Name:** BigScore Admin Dashboard  
**Platform:** Web — Desktop and Mobile Responsive  
**Framework:** Next.js 14+ with App Router  
**Language:** TypeScript  
**Styling:** Tailwind CSS  
**UI Library:** shadcn/ui  
**Backend:** Firebase — Firestore, Storage, Authentication, Remote Config, Cloud Messaging  
**Deployment:** Vercel  
**Local Development:** Firebase Emulator Suite  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Visual Design System](#2-visual-design-system)
3. [Authentication and Security](#3-authentication-and-security)
4. [Dashboard Layout](#4-dashboard-layout)
5. [Feature Modules](#5-feature-modules)
6. [Component Library](#6-component-library)
7. [Data Models and Firebase Structure](#7-data-models-and-firebase-structure)
8. [API Routes and Server Actions](#8-api-routes-and-server-actions)
9. [Responsive Design](#9-responsive-design)
10. [Local Development Setup](#10-local-development-setup)
11. [Deployment to Vercel](#11-deployment-to-vercel)
12. [Audit Logging and Monitoring](#12-audit-logging-and-monitoring)
13. [Implementation Phases](#13-implementation-phases)
14. [Code Templates](#14-code-templates)
15. [Quality Checklist](#15-quality-checklist)

---

# 1. Project Overview

## 1.1 Purpose

BigScore Admin Panel is a secure web-based dashboard used to manage the dynamic content and configuration of the BigScore iOS app.

Admins can manage live matches, stream URLs, sport packages, channels, optional movies and series, news articles, push notifications, feature flags, users, and analytics.

The admin panel is the control center for everything that appears dynamically in the iOS app.

## 1.2 Core Features

- Secure Firebase Authentication login.
- Role-based access control.
- Live match creation and management.
- Match score, status, stadium, and stream URL management.
- Admin-controlled “Tap to Watch” mode.
- Sport packages and channel management.
- Optional movies and series management.
- News article management.
- Competition and team management.
- App feature toggles through Remote Config or Firestore-backed settings.
- Push notification composer and history.
- User management for admin accounts.
- Analytics dashboard.
- Audit logs for admin activity.
- Firebase Emulator support for local development.
- Vercel deployment.

## 1.3 Important Legal Requirement

If the admin panel is used to add live streams, sport channels, movies, or series, the content must be legally authorized.

The system should only allow content for which the app owner has rights, licenses, or permission to distribute. The admin panel should include fields for source, license status, provider, and expiration date when applicable.

Unauthorized copyrighted streams or media should not be uploaded or linked.

## 1.4 Tech Stack

```yaml
frontend:
  framework: Next.js 14+
  router: App Router
  language: TypeScript
  styling: Tailwind CSS
  component_library: shadcn/ui
  forms: React Hook Form
  validation: Zod
  charts: Recharts or Tremor
  tables: TanStack Table
  icons: Lucide React
  state:
    - React Server Components
    - React Context for auth/session
    - Zustand optional for client UI state

backend:
  auth: Firebase Authentication
  database: Firebase Firestore
  storage: Firebase Storage
  remote_config: Firebase Remote Config
  notifications: Firebase Cloud Messaging
  cloud_functions: Optional Firebase Cloud Functions
  analytics: Firebase Analytics / Google Analytics

deployment:
  hosting: Vercel
  ci_cd: Vercel Git Integration
  environment_variables: Vercel Project Settings

development:
  local_backend: Firebase Emulator Suite
  testing:
    - Jest
    - React Testing Library
    - Playwright optional
```

## 1.5 User Roles

```yaml
roles:
  super_admin:
    description: Full platform owner/admin.
    permissions:
      - manage all content
      - manage users and roles
      - manage app configuration
      - send notifications
      - view analytics
      - view audit logs
      - delete content

  content_manager:
    description: Manages app content.
    permissions:
      - manage matches
      - manage competitions
      - manage teams
      - manage news
      - manage sport packages
      - manage channels
      - manage movies and series if enabled
      - upload images/media
      - cannot manage users
      - cannot modify critical app configuration

  moderator:
    description: Operational role for monitoring and messaging.
    permissions:
      - view dashboard
      - view analytics
      - send notifications
      - view live matches
      - cannot delete content
      - cannot manage users
      - cannot change app configuration

  viewer:
    description: Read-only admin account.
    permissions:
      - view dashboard
      - view analytics
      - view content
      - cannot create, update, or delete
```

---

# 2. Visual Design System

## 2.1 Design Direction

The admin panel uses a professional dark interface that matches the BigScore iOS app identity but is optimized for productivity, readability, and long-form content management.

The design should feel:

- Premium
- Sport-focused
- Fast
- Clean
- Secure
- Easy to scan

## 2.2 Color Palette

### Background Colors

```css
--bg-primary: #0F1419;
--bg-secondary: #16181D;
--bg-tertiary: #1C1F26;
--bg-elevated: #22252D;
--bg-overlay: rgba(0, 0, 0, 0.65);
```

### Accent Colors

```css
--accent-gold: #FFD700;
--accent-blue: #00D9FF;
--accent-green: #00FF88;
--accent-red: #FF3B5C;
--accent-orange: #FF9500;
--accent-purple: #A855F7;
```

### Text Colors

```css
--text-primary: #FFFFFF;
--text-secondary: #B8C5D6;
--text-tertiary: #6B7A94;
--text-disabled: #3D4A5C;
```

### Border Colors

```css
--border-default: #2A3654;
--border-muted: #1F2937;
--border-focus: #00D9FF;
--border-error: #FF3B5C;
```

### Status Colors

```css
--status-live: #FF3B5C;
--status-scheduled: #FF9500;
--status-finished: #00FF88;
--status-draft: #6B7A94;
--status-disabled: #3D4A5C;
```

## 2.3 Button Colors

```css
--button-primary-bg: #FFD700;
--button-primary-hover: #E6C200;
--button-primary-text: #0F1419;

--button-secondary-bg: #00D9FF;
--button-secondary-hover: #00B8D9;
--button-secondary-text: #0F1419;

--button-danger-bg: #FF3B5C;
--button-danger-hover: #E6334F;
--button-danger-text: #FFFFFF;

--button-ghost-bg: transparent;
--button-ghost-hover: #1C1F26;
--button-ghost-text: #B8C5D6;
```

## 2.4 Typography

Use Inter as the primary web font.

```css
font-family:
  "Inter",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Type Scale

```css
--text-display: 48px / 56px, weight 700;
--text-h1: 32px / 40px, weight 700;
--text-h2: 24px / 32px, weight 600;
--text-h3: 20px / 28px, weight 600;
--text-h4: 18px / 24px, weight 600;

--text-body-lg: 16px / 24px, weight 400;
--text-body: 14px / 20px, weight 400;
--text-body-sm: 13px / 18px, weight 400;

--text-label: 12px / 16px, weight 500;
--text-caption: 11px / 14px, weight 400;

--text-code: 14px / 20px, monospace;
```

## 2.5 Spacing System

Use a 4px/8px spacing scale.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
```

## 2.6 Border Radius

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

## 2.7 Shadows and Glows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);

--glow-gold: 0 0 20px rgba(255, 215, 0, 0.3);
--glow-blue: 0 0 20px rgba(0, 217, 255, 0.3);
--glow-red: 0 0 20px rgba(255, 59, 92, 0.3);
```

## 2.8 Breakpoints

```css
sm: 640px;
md: 768px;
lg: 1024px;
xl: 1280px;
2xl: 1536px;
```

---

# 3. Authentication and Security

## 3.1 Authentication Flow

Admins authenticate using Firebase Authentication with email and password.

Optional future authentication methods:

- Google Sign-In for organization accounts.
- Multi-factor authentication.
- SSO if required.

## 3.2 Login Screen

```yaml
screen: LoginScreen
route: /login

layout:
  background: bg-primary
  alignment: center
  maxWidth: 400px

card:
  background: bg-secondary
  padding: 48px
  borderRadius: radius-xl
  shadow: shadow-xl

logo:
  text: "BigScore Admin"
  color: accent-gold
  font: text-h1
  alignment: center

form:
  fields:
    email:
      type: email
      label: "Email Address"
      required: true
      validation: valid email

    password:
      type: password
      label: "Password"
      required: true
      validation: minimum 8 characters

  submitButton:
    text: "Sign In"
    style: primary
    height: 48px
    loadingState: spinner

  forgotPassword:
    route: /forgot-password
```

## 3.3 Protected Routes

```yaml
public_routes:
  - /login
  - /forgot-password

protected_routes:
  - /dashboard
  - /matches
  - /matches/live
  - /competitions
  - /teams
  - /news
  - /packages
  - /movies
  - /notifications
  - /analytics
  - /users
  - /config
  - /audit-logs
```

## 3.4 Route Permission Matrix

```yaml
/dashboard:
  roles: [super_admin, content_manager, moderator, viewer]

/matches:
  roles: [super_admin, content_manager, moderator, viewer]
  write: [super_admin, content_manager]

/packages:
  roles: [super_admin, content_manager, viewer]
  write: [super_admin, content_manager]

/movies:
  roles: [super_admin, content_manager, viewer]
  write: [super_admin, content_manager]

/news:
  roles: [super_admin, content_manager, viewer]
  write: [super_admin, content_manager]

/config:
  roles: [super_admin]

/users:
  roles: [super_admin]

/notifications:
  roles: [super_admin, moderator]

/analytics:
  roles: [super_admin, content_manager, moderator, viewer]

/audit-logs:
  roles: [super_admin]
```

## 3.5 Security Best Practices

```yaml
security:
  authentication:
    - Firebase Auth required for all protected pages
    - server-side token verification where needed
    - auto logout after inactivity
    - password reset through Firebase

  authorization:
    - role stored in Firestore adminUsers collection or custom claims
    - route-level permission checks
    - server-action permission checks
    - Firestore Security Rules enforcement

  data_protection:
    - validate all inputs with Zod
    - sanitize text content
    - restrict file upload types and sizes
    - prevent public write access
    - protect admin-only collections

  platform:
    - HTTPS enforced by Vercel
    - environment variables stored securely
    - no secrets committed to Git
    - rate limiting for sensitive endpoints
    - audit logs for all create/update/delete actions
```

---

# 4. Dashboard Layout

## 4.1 Main Layout

```yaml
layout: DashboardLayout

structure:
  - sidebar
  - topbar
  - mainContent
```

## 4.2 Sidebar

```yaml
sidebar:
  desktop:
    position: fixed left
    width: 280px
  tablet:
    width: 240px
  mobile:
    mode: drawer

background: bg-secondary
borderRight: 1px solid border-default

header:
  logo:
    text: "BigScore"
    icon: trophy
    color: accent-gold

userInfo:
  avatar: 40x40px
  name: admin display name
  role: role badge
  background: bg-tertiary
```

## 4.3 Sidebar Navigation

```yaml
navigation:
  sections:
    - label: Main
      items:
        - text: Dashboard
          icon: layout-dashboard
          route: /dashboard

        - text: Live Matches
          icon: radio
          route: /matches/live

        - text: All Matches
          icon: calendar
          route: /matches

    - label: Content
      items:
        - text: Competitions
          icon: trophy
          route: /competitions

        - text: Teams
          icon: shield
          route: /teams

        - text: News
          icon: newspaper
          route: /news

        - text: Sport Packages
          icon: package
          route: /packages

        - text: Movies & Series
          icon: film
          route: /movies
          condition: enableMoviesSeries

    - label: Management
      items:
        - text: App Config
          icon: settings
          route: /config
          permission: super_admin

        - text: Notifications
          icon: bell
          route: /notifications

        - text: Users
          icon: users
          route: /users
          permission: super_admin

        - text: Analytics
          icon: bar-chart
          route: /analytics

        - text: Audit Logs
          icon: history
          route: /audit-logs
          permission: super_admin
```

## 4.4 Topbar

```yaml
topbar:
  height: 64px
  position: fixed top
  background: bg-primary
  borderBottom: 1px solid border-default

leftSection:
  mobileMenuButton:
    visible: mobile only
    action: open sidebar drawer

  breadcrumbs:
    visible: desktop and tablet

rightSection:
  globalSearch:
    visible: desktop
    placeholder: "Search..."

  notificationButton:
    icon: bell
    badge: unread count

  userMenu:
    items:
      - Profile
      - Settings
      - Sign Out
```

## 4.5 Main Content

```yaml
mainContent:
  desktop:
    marginLeft: 280px
  tablet:
    marginLeft: 240px
  mobile:
    marginLeft: 0

  marginTop: 64px
  padding:
    desktop: 24px
    mobile: 16px

  background: bg-primary
  minHeight: calc(100vh - 64px)
```

## 4.6 Dashboard Home Screen

```yaml
screen: DashboardHome
route: /dashboard

sections:
  statsCards:
    grid:
      desktop: 4 columns
      tablet: 2 columns
      mobile: 1 column

    cards:
      - label: Total Users
        icon: users
        color: accent-blue

      - label: Live Matches
        icon: radio
        color: accent-red

      - label: Active Packages
        icon: package
        color: accent-gold

      - label: Notifications Sent
        icon: bell
        color: accent-green

  quickActions:
    title: Quick Actions
    actions:
      - Add Match
      - Send Notification
      - Upload Content
      - View Analytics

  liveMatchesTable:
    title: Live Matches
    maxRows: 5
    route: /matches/live

  recentActivity:
    title: Recent Activity
    source: auditLogs
    maxItems: 8
```

---

# 5. Feature Modules

## 5.1 Match Management

### Match List Screen

```yaml
screen: MatchListScreen
route: /matches

header:
  title: Matches
  actions:
    - Add Match
    - Import Matches optional

filters:
  - dateRange
  - status:
      options: [All, Scheduled, Live, Finished, Postponed, Cancelled]
  - competition
  - sport
  - search teams

table:
  columns:
    - Competition
    - Home Team
    - Score
    - Away Team
    - Date and Time
    - Status
    - Watch Mode
    - Actions

pagination:
  itemsPerPage: 20
  showTotal: true
```

### Match Form

```yaml
component: MatchForm
routes:
  create: /matches/new
  edit: /matches/[id]/edit

sections:
  basicInfo:
    fields:
      - competitionId
      - sport
      - homeTeamId
      - awayTeamId
      - stadiumName
      - startDateTime
      - timezone
      - status

  scoreInfo:
    visibleWhen: status != Scheduled
    fields:
      - homeScore
      - awayScore
      - currentMinute
      - period

  streamingConfig:
    fields:
      - enableWatchMode
      - streamUrl
      - streamProvider
      - streamQuality
      - licenseStatus
      - licenseExpiresAt

  publishing:
    fields:
      - isPublished
      - displayOrder optional

validation:
  - homeTeamId must not equal awayTeamId
  - startDateTime required
  - scores must be non-negative
  - streamUrl required if enableWatchMode is true
  - streamUrl must be valid URL
  - licenseStatus required if streamUrl exists
```

## 5.2 Live Match Management

```yaml
screen: LiveMatchesScreen
route: /matches/live

features:
  - filter only live matches
  - quick score update
  - quick match minute update
  - toggle watch mode
  - edit stream URL
  - finish match button
  - send match event notification
```

## 5.3 Sport Packages Management

### Packages List

```yaml
screen: PackagesListScreen
route: /packages

header:
  title: Sport Packages
  subtitle: Manage sport streaming packages and channels
  actions:
    - Create Package

grid:
  desktop: 4 columns
  tablet: 3 columns
  mobile: 2 columns

packageCard:
  imageAspectRatio: 2:2.3
  title
  channelCount
  statusBadge
  hoverActions:
    - Edit
    - View Channels
    - Delete
```

### Package Form

```yaml
component: PackageForm
routes:
  create: /packages/new
  edit: /packages/[id]/edit

fields:
  - name:
      type: text
      required: true
      maxLength: 50

  - description:
      type: textarea
      maxLength: 200

  - image:
      type: imageUpload
      required: true
      formats: [jpg, jpeg, png, webp]
      maxSize: 5MB
      aspectRatio: 2:2.3

  - category:
      type: select
      options: [Football, Basketball, Tennis, Other]

  - isActive:
      type: toggle

  - displayOrder:
      type: number

  - licenseNotes:
      type: textarea
      description: Rights/license information for package content
```

## 5.4 Channel Management

```yaml
screen: ChannelsListScreen
route: /packages/[packageId]/channels

fields:
  - channelName
  - channelLogo
  - streamUrl
  - streamProvider
  - quality
  - isActive
  - displayOrder
  - licenseStatus
  - licenseExpiresAt

actions:
  - add channel
  - edit channel
  - delete channel
  - test stream URL
```

## 5.5 Movies and Series Management

This module is optional and controlled by app configuration.

### Movies and Series List

```yaml
screen: MoviesSeriesListScreen
route: /movies

header:
  title: Movies & Series
  featureToggle:
    label: Enable Movies & Series in App
    permission: super_admin

tabs:
  - All
  - Movies
  - Series
  - Categories

filters:
  - category
  - status
  - type
  - search

grid:
  desktop: 5 columns
  tablet: 3 columns
  mobile: 2 columns
```

### Movie/Series Form

```yaml
component: MediaContentForm
routes:
  create: /movies/new
  edit: /movies/[id]/edit

fields:
  - type:
      options: [Movie, Series]

  - title:
      required: true
      maxLength: 100

  - description:
      maxLength: 500

  - posterImage:
      aspectRatio: 2:3
      required: true

  - backdropImage:
      aspectRatio: 16:9

  - releaseYear:
      min: 1900
      max: currentYear + 1

  - durationMinutes:
      visibleWhen: type == Movie

  - categories:
      type: multiSelect

  - rating:
      options: [G, PG, PG-13, R, NC-17, Unrated]

  - videoUrl:
      required: true
      validation: valid URL

  - subtitles:
      type: multiSelect

  - isActive:
      type: toggle

  - isFeatured:
      type: toggle

  - licenseStatus:
      required: true

  - licenseExpiresAt:
      optional date

  - providerName:
      optional text
```

## 5.6 News Management

```yaml
screen: NewsListScreen
route: /news

features:
  - create news article
  - edit article
  - delete article
  - publish/unpublish
  - feature article
  - category filter
  - search by title

articleFields:
  - title
  - summary
  - body
  - image
  - sourceName
  - sourceUrl
  - category
  - publishedAt
  - isPublished
  - isFeatured
```

## 5.7 Competitions Management

```yaml
screen: CompetitionsScreen
route: /competitions

features:
  - create competition
  - edit competition
  - delete competition
  - set active/inactive
  - assign sport
  - upload logo or flag
  - manage display order

fields:
  - name
  - country
  - sport
  - logoUrl
  - flagUrl
  - isActive
  - displayOrder
```

## 5.8 Teams Management

```yaml
screen: TeamsScreen
route: /teams

features:
  - create team
  - edit team
  - delete team
  - upload logo
  - assign country and sport
  - search and filter

fields:
  - name
  - shortName
  - logoUrl
  - country
  - sport
  - isActive
```

## 5.9 App Configuration Management

```yaml
screen: AppConfigScreen
route: /config
permission: super_admin

settings:
  featureFlags:
    - enableSportPackages
    - enableMoviesSeries
    - enableLiveWatchButton
    - enableAdMob
    - enableAppOpenAds
    - enableInterstitialAds
    - enableNews
    - enablePushNotifications

  adMob:
    - appOpenAdUnitId
    - interstitialAdUnitId
    - adFrequencyCap
    - testMode

  app:
    - minimumSupportedVersion
    - forceUpdateEnabled
    - maintenanceMode
    - maintenanceMessage

  theme:
    - newsBackgroundTheme
    - featuredCompetitionIds

ui:
  - grouped setting cards
  - switches
  - text inputs
  - confirmation toasts
  - last updated timestamp
```

## 5.10 Push Notifications Management

```yaml
screen: NotificationsScreen
route: /notifications
roles:
  - super_admin
  - moderator

composer:
  fields:
    - title:
        required: true
        maxLength: 50

    - body:
        required: true
        maxLength: 150

    - notificationType:
        options:
          - matchStart
          - goal
          - matchEnd
          - news
          - announcement

    - targetAudience:
        options:
          - allUsers
          - favoriteTeamUsers
          - matchFollowers
          - customTopic

    - targetId:
        optional depending on audience

    - deepLink:
        optional

    - scheduleTime:
        optional

preview:
  type: device notification mockup

history:
  columns:
    - title
    - type
    - target
    - sentAt
    - status
    - sentBy
```

## 5.11 Analytics Dashboard

```yaml
screen: AnalyticsScreen
route: /analytics

metrics:
  - totalUsers
  - dailyActiveUsers
  - monthlyActiveUsers
  - matchesViewed
  - liveMatchesViewed
  - notificationsSent
  - packagesOpened
  - videoPlays
  - adImpressions
  - estimatedAdRevenue

charts:
  - userGrowthLineChart
  - activeUsersLineChart
  - popularCompetitionsBarChart
  - notificationOpenRateChart
  - deviceBreakdownPieChart

features:
  - date range filter
  - export CSV
  - responsive chart layout
```

## 5.12 User Management

```yaml
screen: UsersScreen
route: /users
permission: super_admin

features:
  - list admin users
  - invite admin user
  - change role
  - disable account
  - enable account
  - send password reset email
  - view user activity

columns:
  - email
  - displayName
  - role
  - status
  - createdAt
  - lastLoginAt
```

---

# 6. Component Library

## 6.1 Button

```yaml
component: Button

variants:
  - primary
  - secondary
  - danger
  - ghost
  - outline

sizes:
  - sm
  - md
  - lg

states:
  - default
  - hover
  - focused
  - disabled
  - loading
```

## 6.2 Input

```yaml
component: Input

types:
  - text
  - email
  - password
  - number
  - url
  - search

features:
  - label
  - placeholder
  - helper text
  - error text
  - icon support
```

## 6.3 Select and MultiSelect

```yaml
component: Select

features:
  - searchable options
  - async loading
  - single select
  - multi select
  - clear selection
  - disabled state
```

## 6.4 Toggle Switch

```yaml
component: ToggleSwitch

usage:
  - feature flags
  - active/inactive status
  - watch mode
  - publish status
```

## 6.5 Data Table

```yaml
component: DataTable

features:
  - sorting
  - filtering
  - pagination
  - row actions
  - loading skeleton
  - empty state
  - responsive overflow
```

## 6.6 Modal

```yaml
component: Modal

types:
  - confirmation
  - form
  - preview
  - destructive action

features:
  - close on escape
  - close on overlay click optional
  - focus trap
  - accessible labels
```

## 6.7 Upload Component

```yaml
component: FileUpload

features:
  - drag and drop
  - image preview
  - progress indicator
  - file type validation
  - file size validation
  - Firebase Storage upload
```

## 6.8 Status Badge

```yaml
component: StatusBadge

variants:
  - live
  - scheduled
  - finished
  - draft
  - published
  - disabled
  - error
```

## 6.9 Toast Notification

```yaml
component: Toast

types:
  - success
  - error
  - warning
  - info

usage:
  - save success
  - validation error
  - upload complete
  - delete confirmation
```

---

# 7. Data Models and Firebase Structure

## 7.1 Firestore Collections

```yaml
collections:
  adminUsers:
    description: Admin accounts and roles

  matches:
    description: Match data for the iOS app

  competitions:
    description: League and competition data

  teams:
    description: Team data

  standings:
    description: League standings

  news:
    description: News articles

  packages:
    description: Sport/media packages

  channels:
    description: Channels inside packages

  mediaContent:
    description: Movies and series

  appSettings:
    description: App configuration fallback/settings

  notifications:
    description: Notification history

  auditLogs:
    description: Admin action logs

  analyticsSummary:
    description: Optional aggregated analytics data
```

## 7.2 Admin User Model

```typescript
type AdminRole = "super_admin" | "content_manager" | "moderator" | "viewer";

interface AdminUser {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  status: "active" | "disabled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}
```

## 7.3 Match Model

```typescript
interface Match {
  id: string;
  sport: string;
  competitionId: string;
  competitionName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;
  stadiumName?: string;
  startDate: Timestamp;
  timezone: string;
  status: "scheduled" | "live" | "halftime" | "finished" | "postponed" | "cancelled";
  homeScore?: number;
  awayScore?: number;
  currentMinute?: number;
  enableWatchMode: boolean;
  streamUrl?: string;
  streamProvider?: string;
  streamQuality?: "auto" | "1080p" | "720p" | "480p";
  licenseStatus?: "verified" | "pending" | "expired" | "not_required";
  licenseExpiresAt?: Timestamp;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy?: string;
}
```

## 7.4 Package Model

```typescript
interface SportPackage {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  category?: string;
  isActive: boolean;
  displayOrder: number;
  licenseNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 7.5 Channel Model

```typescript
interface Channel {
  id: string;
  packageId: string;
  name: string;
  logoUrl?: string;
  streamUrl: string;
  streamProvider?: string;
  quality: "auto" | "1080p" | "720p" | "480p";
  isActive: boolean;
  displayOrder: number;
  licenseStatus: "verified" | "pending" | "expired";
  licenseExpiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 7.6 Media Content Model

```typescript
interface MediaContent {
  id: string;
  type: "movie" | "series";
  title: string;
  description?: string;
  posterUrl: string;
  backdropUrl?: string;
  releaseYear?: number;
  durationMinutes?: number;
  categories: string[];
  rating?: string;
  videoUrl: string;
  subtitles?: string[];
  isActive: boolean;
  isFeatured: boolean;
  licenseStatus: "verified" | "pending" | "expired";
  licenseExpiresAt?: Timestamp;
  providerName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 7.7 App Settings Model

```typescript
interface AppSettings {
  enableSportPackages: boolean;
  enableMoviesSeries: boolean;
  enableLiveWatchButton: boolean;
  enableAdMob: boolean;
  enableAppOpenAds: boolean;
  enableInterstitialAds: boolean;
  enableNews: boolean;
  enablePushNotifications: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  minimumSupportedVersion?: string;
  forceUpdateEnabled: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

## 7.8 Audit Log Model

```typescript
interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: "create" | "update" | "delete" | "login" | "send_notification";
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
```

---

# 8. API Routes and Server Actions

## 8.1 Recommended Approach

Use Next.js Server Actions for secure form submissions and admin operations. Use API routes when needed for webhook-style or external integrations.

All write operations must:

- Verify authentication.
- Verify user role.
- Validate input with Zod.
- Write to Firestore.
- Create an audit log.
- Return structured success/error response.

## 8.2 Server Actions

```yaml
serverActions:
  matches:
    - createMatch
    - updateMatch
    - deleteMatch
    - updateMatchScore
    - toggleWatchMode

  packages:
    - createPackage
    - updatePackage
    - deletePackage

  channels:
    - createChannel
    - updateChannel
    - deleteChannel
    - testChannelStream

  media:
    - createMediaContent
    - updateMediaContent
    - deleteMediaContent

  news:
    - createNewsArticle
    - updateNewsArticle
    - deleteNewsArticle
    - publishNewsArticle

  config:
    - updateAppSettings
    - updateRemoteConfigFlag

  notifications:
    - sendPushNotification
    - schedulePushNotification

  users:
    - inviteAdminUser
    - updateAdminRole
    - disableAdminUser
    - enableAdminUser
```

## 8.3 API Routes

```yaml
apiRoutes:
  /api/notifications/send:
    method: POST
    permission: super_admin or moderator

  /api/upload/sign:
    method: POST
    permission: authenticated admin

  /api/streams/test:
    method: POST
    permission: super_admin or content_manager

  /api/analytics/export:
    method: GET
    permission: authenticated admin

  /api/webhooks/firebase:
    method: POST
    usage: optional backend events
```

## 8.4 Validation

Use Zod schemas for all forms.

```yaml
validation_rules:
  email: valid email format
  url: valid URL
  title: required, max length
  image: allowed MIME types only
  streamUrl: required only when watch mode is enabled
  role: must be valid enum
  scores: non-negative integers
```

---

# 9. Responsive Design

## 9.1 Mobile Behavior

```yaml
mobile:
  sidebar: drawer
  topbar: hamburger menu visible
  forms: single column
  tables: horizontal scroll or card layout
  grids: 1 to 2 columns
  padding: 16px
```

## 9.2 Tablet Behavior

```yaml
tablet:
  sidebar: fixed or collapsible
  forms: 1 to 2 columns
  grids: 2 to 3 columns
  charts: 1 to 2 columns
```

## 9.3 Desktop Behavior

```yaml
desktop:
  sidebar: fixed
  topbar: full breadcrumbs and search
  forms: two columns where appropriate
  grids: 4 to 5 columns
  tables: full layout
```

## 9.4 Accessibility

- Use semantic HTML.
- Ensure keyboard navigation.
- Use focus rings.
- Add aria labels to icon buttons.
- Maintain sufficient contrast.
- Support screen readers.
- Avoid color-only status indicators.

---

# 10. Local Development Setup

## 10.1 Requirements

```yaml
requirements:
  - Node.js 20+
  - npm, pnpm, or yarn
  - Firebase CLI
  - Git
```

## 10.2 Environment Variables

Create `.env.local`.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_PROJECT_ID=

NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

## 10.3 Firebase Emulators

```bash
firebase emulators:start
```

Recommended emulators:

```yaml
emulators:
  - Firestore
  - Authentication
  - Storage
  - Functions
```

## 10.4 Next.js Development Server

```bash
npm install
npm run dev
```

The admin panel should run at:

```text
http://localhost:3000
```

---

# 11. Deployment to Vercel

## 11.1 Deployment Flow

```yaml
deployment:
  provider: Vercel
  trigger: push to main branch
  buildCommand: npm run build
  output: Next.js default
```

## 11.2 Environment Variables

All Firebase and admin secrets must be configured in Vercel Project Settings.

Do not commit secrets to Git.

## 11.3 Production Checklist

```yaml
production:
  - Firebase production project connected
  - Firestore security rules deployed
  - Storage security rules deployed
  - Vercel environment variables configured
  - Firebase Admin SDK credentials configured
  - Emulator mode disabled
  - Admin users created
  - Domain configured
  - HTTPS verified
```

---

# 12. Audit Logging and Monitoring

## 12.1 Audit Events

Log the following actions:

```yaml
audit_events:
  - admin login
  - create match
  - update match
  - delete match
  - update stream URL
  - create package
  - delete package
  - create media content
  - delete media content
  - update app configuration
  - send notification
  - update user role
  - disable user
```

## 12.2 Monitoring

```yaml
monitoring:
  - Firebase Crashlytics optional for app
  - Vercel logs for web errors
  - Firebase Functions logs
  - Firestore usage monitoring
  - Storage usage monitoring
```

## 12.3 Error Handling

- Show friendly error messages in the UI.
- Log detailed errors server-side.
- Never expose sensitive stack traces to users.
- Provide retry actions for failed operations.

---

# 13. Implementation Phases

## Phase 1 — Foundation

- Create Next.js project.
- Add TypeScript.
- Configure Tailwind CSS.
- Add shadcn/ui.
- Configure Firebase client SDK.
- Configure Firebase Admin SDK.
- Create base layout.
- Create login screen.
- Add role-based auth guard.

## Phase 2 — Core Dashboard

- Build sidebar and topbar.
- Build dashboard home.
- Add stats cards.
- Add recent activity.
- Add global loading and error UI.

## Phase 3 — Content Management

- Matches module.
- Live matches module.
- Competitions module.
- Teams module.
- News module.
- File upload component.

## Phase 4 — Packages and Media

- Sport packages module.
- Channels module.
- Movies and series module.
- Stream URL validation.
- License/compliance fields.

## Phase 5 — App Configuration

- App config page.
- Remote Config integration.
- Feature flag management.
- Maintenance mode controls.
- AdMob config controls.

## Phase 6 — Notifications

- Notification composer.
- Notification preview.
- Send notification flow.
- Notification history.
- Cloud Function integration.

## Phase 7 — Users, Analytics, and Audit Logs

- Admin user management.
- Analytics dashboard.
- Audit logs table.
- CSV export.

## Phase 8 — Testing and Deployment

- Add unit tests.
- Add form validation tests.
- Add basic E2E tests.
- Deploy to Vercel.
- Validate production Firebase security rules.

---

# 14. Code Templates

## 14.1 Firebase Client Setup

```typescript
// lib/firebase/client.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

if (
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
  } catch {
    // Emulator may already be connected during hot reload.
  }
}
```

## 14.2 Firebase Admin Setup

```typescript
// lib/firebase/admin.ts

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
```

## 14.3 Role Check Helper

```typescript
// lib/auth/permissions.ts

export type AdminRole =
  | "super_admin"
  | "content_manager"
  | "moderator"
  | "viewer";

const rolePermissions: Record<AdminRole, string[]> = {
  super_admin: ["*"],
  content_manager: [
    "matches:write",
    "packages:write",
    "channels:write",
    "news:write",
    "competitions:write",
    "teams:write",
  ],
  moderator: ["notifications:send", "analytics:read", "matches:read"],
  viewer: ["analytics:read", "content:read"],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  const permissions = rolePermissions[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}
```

## 14.4 Match Validation Schema

```typescript
// lib/validation/matchSchema.ts

import { z } from "zod";

export const matchSchema = z
  .object({
    competitionId: z.string().min(1),
    sport: z.string().min(1),
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    stadiumName: z.string().optional(),
    startDate: z.string().min(1),
    status: z.enum([
      "scheduled",
      "live",
      "halftime",
      "finished",
      "postponed",
      "cancelled",
    ]),
    homeScore: z.coerce.number().int().min(0).optional(),
    awayScore: z.coerce.number().int().min(0).optional(),
    enableWatchMode: z.boolean().default(false),
    streamUrl: z.string().url().optional().or(z.literal("")),
    licenseStatus: z
      .enum(["verified", "pending", "expired", "not_required"])
      .optional(),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "Home team and away team must be different.",
    path: ["awayTeamId"],
  })
  .refine((data) => !data.enableWatchMode || Boolean(data.streamUrl), {
    message: "Stream URL is required when watch mode is enabled.",
    path: ["streamUrl"],
  });
```

## 14.5 Audit Log Helper

```typescript
// lib/audit/createAuditLog.ts

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

interface CreateAuditLogInput {
  actorUid: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  await adminDb.collection("auditLogs").add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

## 14.6 Example Server Action

```typescript
// app/actions/matches.ts

"use server";

import { adminDb } from "@/lib/firebase/admin";
import { matchSchema } from "@/lib/validation/matchSchema";
import { createAuditLog } from "@/lib/audit/createAuditLog";

export async function createMatchAction(formData: unknown, actor: {
  uid: string;
  email: string;
  role: string;
}) {
  if (actor.role !== "super_admin" && actor.role !== "content_manager") {
    return {
      success: false,
      error: "You do not have permission to create matches.",
    };
  }

  const parsed = matchSchema.safeParse(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid match data.",
      issues: parsed.error.flatten(),
    };
  }

  const docRef = await adminDb.collection("matches").add({
    ...parsed.data,
    createdBy: actor.uid,
    updatedBy: actor.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await createAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "create",
    resourceType: "match",
    resourceId: docRef.id,
    description: "Created a new match.",
  });

  return {
    success: true,
    id: docRef.id,
  };
}
```

---

# 15. Quality Checklist

## Design and UI

- [ ] Dark theme is consistent.
- [ ] Sidebar and topbar work on all screen sizes.
- [ ] Forms are responsive.
- [ ] Tables handle overflow correctly.
- [ ] Buttons, inputs, modals, badges, and cards follow the design system.
- [ ] Loading, empty, and error states are implemented.

## Authentication and Security

- [ ] Firebase Auth login works.
- [ ] Protected routes redirect unauthenticated users.
- [ ] Role-based access is enforced.
- [ ] Server actions verify permissions.
- [ ] Firestore Security Rules are deployed.
- [ ] Storage Security Rules are deployed.
- [ ] Environment variables are not exposed incorrectly.
- [ ] Admin actions are audit logged.

## Content Management

- [ ] Matches can be created, edited, deleted, and filtered.
- [ ] Live match score updates work.
- [ ] Watch mode can be toggled.
- [ ] Stream URL validation works.
- [ ] Competitions and teams can be managed.
- [ ] News can be created and published.
- [ ] Packages and channels can be managed.
- [ ] Movies and series can be managed if enabled.

## Legal and Compliance

- [ ] Stream and media license fields exist.
- [ ] Admins can mark license status.
- [ ] Expired licenses are visible.
- [ ] Unauthorized content is not knowingly added.
- [ ] Privacy policy and terms are linked where needed.

## Notifications

- [ ] Notification composer validates inputs.
- [ ] Notification preview works.
- [ ] Notifications can be sent to correct audiences.
- [ ] Notification history is recorded.
- [ ] Failed sends are visible.

## App Configuration

- [ ] Feature flags update correctly.
- [ ] Remote Config or Firestore settings are synced.
- [ ] Maintenance mode works.
- [ ] AdMob settings are configurable.
- [ ] Only super_admin can edit configuration.

## Deployment

- [ ] Firebase production project configured.
- [ ] Vercel environment variables configured.
- [ ] Build passes.
- [ ] Emulator mode disabled in production.
- [ ] Production security rules tested.
- [ ] Admin user account created.
```
