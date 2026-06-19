# Allure Living ERP Setup & Deployment Guide

This documentation guides you through installing, configuring, running, and deploying the Allure Living ERP system.

---

## 1. Local Manual Setup (Development Mode)

Follow these instructions to run the backend and frontend services side-by-side locally.

### A. Prerequisites
* **Node.js**: v18.x or v20.x
* **Python**: v3.11.x
* **Git** (optional)

### B. Running the Backend (FastAPI)
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Seed the SQLite database with initial master tables & default user credentials:
   ```bash
   python seed.py
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   * The API Swagger documentation is available at `http://localhost:8000/docs`

### C. Running the Frontend (Next.js)
1. From the project root, install packages:
   ```bash
   npm install
   ```
2. Run the development environment server:
   ```bash
   npm run dev
   ```
   * The client Web UI is accessible at `http://localhost:3000`

---

## 2. Docker & Nginx Deployment (Production-Ready)

This multi-container setup starts PostgreSQL, Redis, backend FastAPI, frontend Next.js, and an Nginx reverse proxy routing requests.

### A. Environment Configuration
The root `docker-compose.yml` configures default variables. You can override these using custom env variables.

### B. Launching the Multi-Container Cluster
Execute this single orchestrator command from the project root:
```bash
docker-compose up -d --build
```
This command starts:
* `db`: PostgreSQL database server on port `5432`
* `redis`: Redis broker on port `6379`
* `backend`: FastAPI API server on port `8000`
* `frontend`: Next.js web UI client on port `3000`
* `nginx`: Nginx reverse proxy listening on port `80` (public access)

### C. Access URL
* Open `http://localhost` in your browser. Nginx acts as the reverse proxy, serving the Next.js UI on `/` and proxying API endpoints through `/api`.

---

## 3. Pre-populated Demo Credentials

Login to the system at `http://localhost` (or `http://localhost:3000`) using any of the following seeded user roles:

| Email | Password | Role Name | Allowed Permissions |
| :--- | :--- | :--- | :--- |
| **admin@allure.com** | `admin123` | **Super Admin** | Full access to user management, logs, database backups & configs |
| **store@allure.com** | `store123` | **Inventory Manager** | Inventory control, category updates, bulk CSV import, stock approvals |
| **pm@allure.com** | `pm123` | **Project Manager** | Create projects, add BOM records, issue material requests |
| **accountant@allure.com**| `accountant123`| **Accountant** | Purchase Orders lifecycle, billing, financial costs audit |
| **staff@allure.com** | `staff123` | **Staff** | View-only access to assigned carpenter schedules and dashboard |

---

## 4. Key Workflows & Features

### A. Bulk Import Materials
* **Role**: Inventory Manager / Store Keeper or higher.
* Go to the **Inventory Control** screen and click **Import CSV**.
* Select a CSV file. The columns can map dynamically. An example structure:
  `Material Code/SKU, Material Name, Category, Brand, Unit, Quantity, Minimum Level, Unit Cost ($), Barcode`
* Barcodes are auto-generated sequentially if missing from your CSV file.

### B. Reporting Engine Exports
* Go to the **Reporting Engine** tab.
* The system lists reports for **Valuation**, **Projects Budgeting**, and **Purchase PO Audits**.
* Download your data directly as **CSV**, **Excel (.xlsx)**, or **PDF** files.
