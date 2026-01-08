import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// --- TYPES ---
interface Debt {
  id?: number;
  why: string;
  cost: string;
  who: string;
}
interface InputStore {
  value: string;
}

// --- ASCII ART BANNER ---
const BANNER = `
=========================
  ____  _____ ____ _____
 |  _ \\| ____| __ )_   _|
 | | | |  _| |  _ \\ | |
 | |_| | |___| |_) || |
 |____/|_____|____/ |_|
      T R A C K E R
=========================
`;

// Set the global background color for the body
document.body.style.backgroundColor = "#0f172a";
document.body.style.color = "#4ade80"; // Classic Terminal Green

const web = {
  native: {
    async vibrate() {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      }
    },
    async notify(title: string, body: string) {
      if (!Capacitor.isNativePlatform()) {
        alert(`${title}\n${body}`);
        return;
      }
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted")
        await LocalNotifications.requestPermissions();
      await LocalNotifications.schedule({
        notifications: [{ title, body, id: Date.now(), sound: "default" }],
      });
    },
  },

  db: {
    _instance: null as IDBDatabase | null,
    async init(): Promise<void> {
      return new Promise((resolve) => {
        const request = indexedDB.open("DebtDB", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("debts")) {
            db.createObjectStore("debts", {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        };
        request.onsuccess = () => {
          this._instance = request.result;
          resolve();
        };
      });
    },
    async add(debt: Debt) {
      const tx = this._instance!.transaction("debts", "readwrite");
      tx.objectStore("debts").add(debt);
    },
    async getAll(): Promise<Debt[]> {
      return new Promise((resolve) => {
        const tx = this._instance!.transaction("debts", "readonly");
        const req = tx.objectStore("debts").getAll();
        req.onsuccess = () => resolve(req.result);
      });
    },
    async remove(id: number) {
      const tx = this._instance!.transaction("debts", "readwrite");
      tx.objectStore("debts").delete(id);
    },
  },

  ui: {
    _getRoot() {
      return document.getElementById("app") || document.body;
    },

    ascii(art: string) {
      const el = document.createElement("pre");
      Object.assign(el.style, {
        fontFamily: "'Courier New', monospace",
        fontSize: "10px",
        lineHeight: "1.2",
        color: "#4ade80",
        textAlign: "center",
        backgroundColor: "#1e293b",
        padding: "15px",
        borderRadius: "4px",
        margin: "10px auto",
        width: "fit-content",
        border: "1px solid #334155",
      });
      el.textContent = art;
      this._getRoot().appendChild(el);
      return el;
    },

    text(content: string, fontSize = "16px", color = "#4ade80") {
      const el = document.createElement("p");
      Object.assign(el.style, {
        fontFamily: "'Courier New', monospace",
        fontSize,
        color,
        textAlign: "center",
      });
      el.textContent = content;
      this._getRoot().appendChild(el);
      return el;
    },

    input(placeholder: string, store: InputStore) {
      const el = document.createElement("input");
      el.placeholder = `> ${placeholder.toUpperCase()}`;
      Object.assign(el.style, {
        width: "90%",
        maxWidth: "350px",
        padding: "14px",
        margin: "8px auto",
        borderRadius: "0px",
        border: "1px solid #4ade80",
        display: "block",
        fontSize: "16px",
        fontFamily: "'Courier New', monospace",
        backgroundColor: "#0f172a",
        color: "#4ade80",
        outline: "none",
      });
      el.oninput = () => {
        store.value = el.value;
      };
      this._getRoot().appendChild(el);
      return el;
    },

    button(title: string, isAction = true) {
      const btn = document.createElement("button");
      btn.textContent = `[ ${title.toUpperCase()} ]`;
      Object.assign(btn.style, {
        width: "90%",
        maxWidth: "350px",
        padding: "14px",
        margin: "10px auto",
        borderRadius: "0px",
        border: isAction ? "1px solid #4ade80" : "1px solid #334155",
        backgroundColor: isAction ? "#4ade80" : "transparent",
        color: isAction ? "#0f172a" : "#94a3b8",
        fontWeight: "bold",
        display: "block",
        cursor: "pointer",
        fontFamily: "'Courier New', monospace",
      });
      return btn;
    },
  },
};

// --- APP RENDER ---
const why: InputStore = { value: "" };
const cost: InputStore = { value: "" };
const who: InputStore = { value: "" };

const render = async () => {
  const root = web.ui._getRoot();
  root.innerHTML = "";

  const debts = await web.db.getAll();
  const total = debts.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0);

  web.ui.ascii(BANNER);
  web.ui.text(`SYSTEM_TOTAL: $${total.toFixed(2)}`, "20px", "#4ade80");

  web.ui.input("NAME", who);
  web.ui.input("AMOUNT", cost);
  web.ui.input("REASON", why);

  const addBtn = web.ui.button("Commit to Database");
  addBtn.onclick = async () => {
    if (!who.value || !cost.value) return;
    await web.db.add({ why: why.value, cost: cost.value, who: who.value });
    who.value = "";
    cost.value = "";
    why.value = "";
    web.native.vibrate();
    render();
  };
  web.ui._getRoot().appendChild(addBtn);

  web.ui.text("--- ACTIVE ENTRIES ---", "12px", "#64748b");

  debts.reverse().forEach((d) => {
    const card = web.ui.button(`${d.who}: $${d.cost} | ${d.why}`, false);
    card.onclick = async () => {
      if (confirm("DELETE FROM MEMORY?")) {
        await web.db.remove(d.id!);
        web.native.vibrate();
        render();
      }
    };
    web.ui._getRoot().appendChild(card);
  });
};

(async () => {
  await web.db.init();
  render();
})();
