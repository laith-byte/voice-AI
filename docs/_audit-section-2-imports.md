# Audit Section 2: Imports & Exports

> Generated: 2026-02-20
> Scope: Every `import`/`export` in `src/` audited for broken references, unused exports, dead modules, and circular dependencies.

---

## 1. Broken Imports

### 1a. Missing Files (import path resolves to nonexistent file)

**Result: NONE FOUND**

Every `import ... from "@/..."` and `import ... from "./..."` across all 190+ source files resolves to a valid TypeScript file. No broken path aliases, no references to deleted or renamed modules.

### 1b. Missing Named Exports (importing a name that doesn't exist in the target)

**Result: NONE FOUND**

Every `import { X } from "@/..."` was cross-checked against the target module's actual exports (including re-exports via `export *`). All named imports match.

### 1c. TypeScript Compilation

**Result: CLEAN (`npx tsc --noEmit` exits 0)**

No type-level import errors, no unresolved modules, no missing type declarations.

### 1d. Dynamic Imports

The only dynamic import of a local/aliased module is in `src/hooks/use-retell-call.ts:58`:
```ts
const { RetellWebClient } = await import("retell-client-js-sdk");
```
This imports the external npm package `retell-client-js-sdk` (installed in `node_modules`). No broken dynamic imports found.

---

## 2. Circular Dependencies

**Result: NONE FOUND**

Full dependency graph analysis of all local imports detected no circular import chains.

---

## 3. Dead Modules (Entire files never imported)

These files export code that is **never imported by any other file** in the codebase:

| File | Exports | Why it's dead |
|------|---------|---------------|
| `src/lib/retell-web.ts` | `getRetellWebClient`, `startWebCall`, `stopWebCall`, `RetellEvent`, re-export of `RetellWebClient` | Wrapper around `retell-client-js-sdk`. The hook `use-retell-call.ts` imports the SDK directly via dynamic `import("retell-client-js-sdk")` instead of using this wrapper. |
| `src/lib/retell.ts` | `listAgents`, `createAgent`, `getAgent`, `updateAgent`, `deleteAgent`, `listCalls`, `getCall`, `listPhoneNumbers`, `purchasePhoneNumber`, `releasePhoneNumber` | Wrapper around `retell-sdk`. All API routes import `retell-sdk` directly (e.g., `import Retell from "retell-sdk"`) instead of using these wrappers. |
| `src/components/ui/command.tsx` | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` | Shadcn/ui command palette component installed but never used anywhere. |
| `src/components/ui/popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription` | Shadcn/ui popover component installed but never used anywhere. |
| `src/components/marketing/sections/features-showcase.tsx` | `FeaturesShowcase` | Marketing section component defined but never rendered on any page. |
| `src/components/marketing/sections/how-it-works.tsx` | `HowItWorks` | Marketing section component defined but never rendered on any page. |
| `src/components/marketing/sections/testimonials.tsx` | `Testimonials` | Marketing section component defined but never rendered on any page. |
| `src/components/automations/automation-logs-table.tsx` | `AutomationLogsTable` | Component defined but never imported/rendered anywhere. |

---

## 4. Unused Exports (file is imported, but specific exports are never used)

### 4a. Library / Business Logic

| File | Unused Export | Notes |
|------|--------------|-------|
| `src/lib/prompt-generator.ts` | `generatePrompt` | Called only internally by `regeneratePrompt()` in the same file. All external consumers import `regeneratePrompt`. The `export` keyword is unnecessary. |
| `src/lib/stripe.ts` | `getAccount` | Stripe wrapper function defined but never called from any API route or component. |
| `src/lib/stripe.ts` | `retrieveCheckoutSession` | Stripe wrapper function defined but never called. |
| `src/lib/retell-costs.ts` | `MONTHLY_COSTS` | Cost constant defined but never referenced outside the file. |
| `src/lib/retell-costs.ts` | `AgentCostConfig` | TypeScript interface used only as a parameter type for `computeAgentCost()` within the same file. No external file imports it by name. |
| `src/hooks/use-agent-config.ts` | `useAgentConfig` | Custom hook exported but never imported by any component. |
| `src/hooks/use-supabase.ts` | `useUser` | Custom hook exported but never imported by any component. |
| `src/hooks/use-supabase.ts` | `useOrganization` | Custom hook exported but never imported by any component. |

### 4b. Type Definitions (via `types/index.ts` barrel re-export)

All types in `src/types/database.ts` and `src/types/retell.ts` are re-exported through `src/types/index.ts` (`export * from "./database"` / `export * from "./retell"`). The following exported types are never imported by name in any consumer file:

| File | Unused Type Export |
|------|--------------------|
| `src/types/database.ts` | `UserRole` |
| `src/types/database.ts` | `WidgetConfig` |
| `src/types/database.ts` | `CampaignConfig` |
| `src/types/database.ts` | `ClientAccess` |
| `src/types/database.ts` | `StripeConnection` |
| `src/types/database.ts` | `ClientAddon` |
| `src/types/database.ts` | `OrganizationSettings` |
| `src/types/database.ts` | `WhitelabelSettings` |
| `src/types/database.ts` | `EmailTemplate` |
| `src/types/database.ts` | `WebhookLog` |
| `src/types/database.ts` | `CampaignLead` |
| `src/types/retell.ts` | `RetellAgent` |
| `src/types/retell.ts` | `RetellTool` |
| `src/types/retell.ts` | `RetellCall` |
| `src/types/retell.ts` | `RetellPhoneNumber` |
| `src/types/retell.ts` | `RetellWebCallResponse` |

### 4c. Shadcn/ui Component Sub-exports

These are parts of shadcn/ui components that were installed with their full API surface but only partially used. Low severity -- standard for shadcn/ui installations. Listed for completeness.

| File | Unused Exports |
|------|----------------|
| `src/components/ui/alert-dialog.tsx` | `AlertDialogMedia`, `AlertDialogOverlay`, `AlertDialogPortal` |
| `src/components/ui/alert.tsx` | `AlertTitle` |
| `src/components/ui/avatar.tsx` | `AvatarImage`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` |
| `src/components/ui/badge.tsx` | `badgeVariants` |
| `src/components/ui/button.tsx` | `buttonVariants` |
| `src/components/ui/card.tsx` | `CardFooter`, `CardAction` |
| `src/components/ui/dialog.tsx` | `DialogClose`, `DialogOverlay`, `DialogPortal` |
| `src/components/ui/dropdown-menu.tsx` | `DropdownMenuPortal`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuShortcut`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` |
| `src/components/ui/scroll-area.tsx` | `ScrollBar` |
| `src/components/ui/select.tsx` | `SelectGroup`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator` |
| `src/components/ui/sheet.tsx` | `SheetTrigger`, `SheetClose`, `SheetFooter` |
| `src/components/ui/table.tsx` | `TableFooter`, `TableCaption` |
| `src/components/ui/tabs.tsx` | `tabsListVariants` |

### 4d. Next.js Framework Exports (FALSE POSITIVES -- not actually unused)

These exports are consumed by the Next.js framework at build time, not by other source files:

| File | Export | Consumed By |
|------|--------|-------------|
| `src/app/(marketing)/industries/[slug]/page.tsx` | `generateStaticParams` | Next.js static generation |
| `src/app/(marketing)/industries/[slug]/page.tsx` | `generateMetadata` | Next.js metadata API |
| `src/middleware.ts` | `config` | Next.js middleware matcher |
| All `page.tsx` / `layout.tsx` / `route.ts` | `default` | Next.js routing |

These are **not issues** -- they are correctly exported for framework consumption.

### 4e. `src/lib/marketing/industries.ts` -- Unused Type

| File | Unused Export | Notes |
|------|--------------|-------|
| `src/lib/marketing/industries.ts` | `IndustryData` | TypeScript interface exported but never imported by name elsewhere. |

### 4f. `src/lib/conversation-flow-templates.ts` -- Unused Type

| File | Unused Export | Notes |
|------|--------------|-------|
| `src/lib/conversation-flow-templates.ts` | `IndustryConfig` | TypeScript interface exported but never imported by name elsewhere. |

### 4g. `src/lib/oauth/providers.ts` -- Unused Type

| File | Unused Export | Notes |
|------|--------------|-------|
| `src/lib/oauth/providers.ts` | `OAuthProviderConfig` | TypeScript interface exported but never imported by name elsewhere. |

---

## 5. Summary

| Category | Count | Severity |
|----------|-------|----------|
| Broken imports (missing files) | 0 | -- |
| Broken named imports | 0 | -- |
| TypeScript compilation errors | 0 | -- |
| Circular dependencies | 0 | -- |
| Dead modules (entire files unused) | 8 | Medium |
| Unused business logic exports | 8 | Medium |
| Unused type definitions | 19 | Low |
| Unused shadcn/ui sub-exports | 40+ | Low (expected for component libraries) |

### Key Recommendations

1. **Remove dead wrapper modules**: `src/lib/retell.ts` and `src/lib/retell-web.ts` are completely unused wrappers. All consumers use the underlying SDK directly. These files add confusion about which import path to use.

2. **Remove unused components**: `AutomationLogsTable`, `FeaturesShowcase`, `HowItWorks`, and `Testimonials` are defined but never rendered. Either they were removed from pages but not deleted, or they are works in progress that should be tracked separately.

3. **Remove unused UI scaffolding**: `command.tsx` and `popover.tsx` are shadcn/ui components installed but never used. They add to bundle size if not tree-shaken.

4. **Clean up unused hooks**: `useAgentConfig`, `useUser`, and `useOrganization` are exported but never consumed. If these were replaced by inline implementations, the exports should be removed.

5. **Un-export internal helpers**: `generatePrompt` in `prompt-generator.ts` is only used internally -- the `export` keyword can be removed.

6. **Audit unused type exports**: 16 type interfaces in `types/database.ts` and `types/retell.ts` are defined but never imported. Some may be used for documentation purposes; others may be leftover from refactors.
