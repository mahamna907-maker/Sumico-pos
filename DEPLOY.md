# Sumico Trade Centre POS — Deploy Guide (Tamil + English)

Idhu ungaloda POS backend + database + frontend. Ithai deploy pannunaa,
oru web link (URL) kedaikkum — adha phone-layum, computer-layum,
eppovum open pannalam. Data database-la permanent-a save aagum.

Default login: **Business ID:** SUMICO001 **Username:** admin **Password:** admin123
(App start aana apparam, DB-la neenga sondha login create pannikkalam.)

---

## STEP 1 — GitHub account create pannunga (free)

1. https://github.com ku po
2. "Sign up" click pannunga, account create pannunga (email + password)

## STEP 2 — Ungaloda code-a GitHub-la upload pannunga

1. GitHub-la login aana apparam, top right "+" icon click pannunga → "New repository"
2. Repository name: `sumico-pos`
3. "Create repository" click pannunga
4. Adhu kaattura page-la "uploading an existing file" nu oru link irukkum — adha click pannunga
5. Intha folder-la irukkira ella files-ayum (server.js, package.json, public folder, .gitignore)
   drag & drop pannunga — **node_modules folder mattum upload pandatheenga** (romba periyadhu, thevai illa)
6. "Commit changes" click pannunga

## STEP 3 — Railway.app-la deploy pannunga (free tier available)

1. https://railway.app ku po, "Login with GitHub" click pannunga
2. Dashboard-la "New Project" → "Deploy from GitHub repo" select pannunga
3. Neenga upload panna `sumico-pos` repo-va select pannunga
4. Railway automatic-a "npm install" & "node server.js" run pannum (namma package.json-la already
   sollirukkom)
5. Konjam nerathukku apparam, "Settings" tab-ku po → "Networking" → "Generate Domain" click pannunga
6. Adhu ungalukku oru link tharum (example: `sumico-pos-production.up.railway.app`)
   — **idhuthaan unga permanent web address**

## STEP 4 — Data permanent-a save aaga Volume attach pannunga (IMPORTANT)

Default-a Railway restart aagum bothu file storage reset aagalam. Data eppavume
irukanumna:

1. Railway project-la unga service-a click pannunga
2. "Settings" tab → "Volumes" section-ku po
3. "+ New Volume" click pannunga
4. Mount path: `/app/data` nu kudunga
5. `server.js` file-la, database path-a `path.join(__dirname, 'sumico.db')`
   nu irukkardha `'/app/data/sumico.db'` nu maathunga (GitHub-la file edit pannalam,
   Railway automatic-a redeploy pannum)

## STEP 5 — Phone-la use pannunga

1. Unga phone browser-la (Chrome) andha Railway link-a open pannunga
2. Login pannunga
3. "Add to Home Screen" pannikanum-na, browser menu-la andha option irukkum —
   adha click panna, phone-la app maadhiri icon varum

---

## Idhu enna features irukku ippo

- Login (database-la check aagum)
- Dashboard (real sales/expense totals)
- Add Sale, POS Sales list
- Add Expense, expense list
- Inventory (barcode, price, qty)
- Customers

## Adutha steps (future)

- Multiple user roles (admin vs cashier separate permissions)
- Sales Return, Quotations, Cash Register (idhukku munnadi demo file-la irundha
  features — backend-ku connect pannanum)
- Better security (password hashing, HTTPS force)
- Automatic backups
