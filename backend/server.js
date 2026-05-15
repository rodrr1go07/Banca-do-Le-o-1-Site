const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONT_DIR = path.join(ROOT_DIR, "front");
const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const IMG_DIR = path.join(FRONT_DIR, "img");

function loadEnvFile() {
    const envPath = path.join(ROOT_DIR, ".env");

    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
            return;
        }

        const [key, ...valueParts] = trimmed.split("=");
        if (!process.env[key]) {
            process.env[key] = valueParts.join("=").trim();
        }
    });
}

loadEnvFile();

const PORT = Number(process.env.PORT || 4000);
const ADMIN_USER = process.env.ADMIN_USER || "banca.do.leao";
const ADMIN_PASS = process.env.ADMIN_PASS || "100958";

const sessions = new Map();

function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 8 * 1024 * 1024) {
                reject(new Error("Arquivo muito grande."));
                req.destroy();
            }
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

function readProducts() {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
}

function saveProducts(products) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

function getToken(req) {
    const auth = req.headers.authorization || "";
    return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function isAuthenticated(req) {
    const token = getToken(req);
    const session = sessions.get(token);

    if (!session) {
        return false;
    }

    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return false;
    }

    return true;
}

function sanitizeImageName(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const allowed = new Set([".jpg", ".jpeg", ".png", ".webp"]);

    if (!allowed.has(ext)) {
        throw new Error("Use uma imagem JPG, PNG ou WEBP.");
    }

    const base = path.basename(fileName, ext)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

    return `${base || "produto"}-${Date.now()}${ext}`;
}

function saveImage(image) {
    if (!image || !image.data || !image.name) {
        return null;
    }

    const fileName = sanitizeImageName(image.name);
    const buffer = Buffer.from(image.data, "base64");
    fs.writeFileSync(path.join(IMG_DIR, fileName), buffer);
    return `../img/${fileName}`;
}

function serveStatic(req, res) {
    const requestPath = decodeURIComponent(req.url.split("?")[0]);
    const cleanPath = requestPath === "/" ? "/pages/index.html" : requestPath;
    const filePath = path.normalize(path.join(FRONT_DIR, cleanPath));

    if (!filePath.startsWith(FRONT_DIR)) {
        res.writeHead(403);
        res.end("Acesso negado");
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Arquivo nao encontrado");
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    };

    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
    if (req.method === "OPTIONS") {
        return sendJson(res, 204, {});
    }

    if (req.method === "POST" && req.url === "/api/login") {
        const body = JSON.parse(await readBody(req) || "{}");

        const usuario = String(body.usuario || "").trim();
        const senha = String(body.senha || "").trim();

        if (usuario !== ADMIN_USER || senha !== ADMIN_PASS) {
            return sendJson(res, 401, { message: "Usuario ou senha invalidos." });
        }

        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { expiresAt: Date.now() + 1000 * 60 * 60 * 8 });
        return sendJson(res, 200, { token });
    }

    if (req.method === "GET" && req.url === "/api/products") {
        return sendJson(res, 200, readProducts());
    }

    if (req.method === "PUT" && req.url.startsWith("/api/products/")) {
        if (!isAuthenticated(req)) {
            return sendJson(res, 401, { message: "Login necessario." });
        }

        const id = decodeURIComponent(req.url.split("/").pop());
        const body = JSON.parse(await readBody(req) || "{}");
        const products = readProducts();
        const index = products.findIndex(product => product.id === id);

        if (index === -1) {
            return sendJson(res, 404, { message: "Produto nao encontrado." });
        }

        const imagePath = saveImage(body.image);
        products[index] = {
            ...products[index],
            name: String(body.name || products[index].name).trim(),
            price: Number(body.price || products[index].price),
            category: String(body.category || products[index].category),
            image: imagePath || products[index].image,
        };

        saveProducts(products);
        return sendJson(res, 200, products[index]);
    }

    return sendJson(res, 404, { message: "Rota nao encontrada." });
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
        handleApi(req, res).catch(error => {
            sendJson(res, 500, { message: error.message || "Erro interno." });
        });
        return;
    }

    serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/pages/admin.html`);
});
