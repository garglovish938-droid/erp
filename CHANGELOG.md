# Changelog - Allure Living ERP

All notable changes to this project will be documented in this file.

## Version: Local v4.4

### Added
* **Langflow AI Automation Upgrade:** Implemented 20 modular workflow layouts for Inventory, Material Request, Purchases, Daily Expenses, Wallets, Cash Book, Receipts, Projects, Employee, Attendance, Reports, OCR, Notifications, Security Monitor, Executive Dashboard, Barcode Scanner, Approvals, Analytics, Auditing, and conversational fallback routing.
* **WebSocket Live Refreshes:** Automated WebSocket broadcasts triggering real-time UI query invalidation updates on the frontend for project, inventory, purchases, expenses, and wallet modifications.
* **Security & Input Validation:** Built RBAC protections, entity parsers, and custom validators for each of the 20 workflows.
* **Classifier Substring Patch:** Added regex-based word boundaries matching to prevent substring collision errors (e.g. check-in/out keywords matching check-inventory queries).

## Version: Local v4.3

### Added
* **Monetary Transfers:** Support for secure wallet-to-wallet and company capital-to-wallet transfers (restricted to Admins & Managers).
* **Archive & Restore:** Ability to view archived/soft-deleted wallets and cash book entries and restore them with a single click.
* **Supplier Timeline backend:** Added backend endpoint `/api/suppliers/{supplier_id}/timeline` (frontend page permanently removed per request).
* **AI Assistant Upgrades:** Enhanced AI ERP Assistant to parse and resolve queries regarding wallet balances, capital ledgers, daily expenses, and client receipts.
* **Langflow Automation Integration:** Integrated dynamic REST client connection supporting Langflow flow calls with environment-based fallback safety.
* **Langflow AI Orchestration Layer (15 Flows):** Designed, initialized, and tested a full orchestration engine classifying user intents across 15 modular assistant flows with RBAC protection and SQLA read-only local resolutions.

### Changed
* **Dynamic Cash Book Ledger Balances:** Cash Book ledger running balances are now computed dynamically and chronologically before filtering.
* **Wallet Recalculations:** Wallet ledger balances now dynamically and chronologically recalculate on all entry additions, edits, soft-deletes, and restorations.
* **Isolated Cash Book:** Disabled automatic syncing of daily expenses to the cash book ledger.
* **Optional Client Receipt Fields:** Marked Linked Project, Invoice Reference, and Invoice Amount as optional inputs.
* **Role Restrictions:**
  - Restricted Daily Expense deletions to Admins only.
  - Restricted Attendance Rule modifications to Admins only.
  - Restricted Project Audit Log access to Managers or higher.
* **Performance:** Fixed N+1 queries on login history log lists.

### Removed
* **Suppliers Page:** Permanently removed the Suppliers UI page component (`Suppliers.tsx`) and all its sidebar navigation links.
