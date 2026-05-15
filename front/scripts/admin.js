const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMensagem = document.getElementById("loginMensagem");
const produtosAdmin = document.getElementById("produtosAdmin");
const API_URL = window.location.origin;

const categorias = {
    suinos: "Suínos",
    bovinos: "Bovinos",
    ovinos: "Ovinos",
    outros: "Outros",
};

let token = localStorage.getItem("adminToken") || "";

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function arquivoParaBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result);
            resolve({
                name: file.name,
                data: result.split(",")[1],
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function criarProdutoForm(produto) {
    const form = document.createElement("form");
    form.className = "produto-form";

    const preview = document.createElement("img");
    preview.src = produto.image;
    preview.alt = produto.name;

    const campos = document.createElement("div");
    campos.className = "campos-produto";

    const nomeLabel = document.createElement("label");
    nomeLabel.textContent = "Nome";
    const nomeInput = document.createElement("input");
    nomeInput.name = "name";
    nomeInput.value = produto.name;
    nomeInput.required = true;
    nomeLabel.appendChild(nomeInput);

    const categoriaLabel = document.createElement("label");
    categoriaLabel.textContent = "Categoria";
    const categoriaSelect = document.createElement("select");
    categoriaSelect.name = "category";
    Object.entries(categorias).forEach(([valor, texto]) => {
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = texto;
        option.selected = produto.category === valor;
        categoriaSelect.appendChild(option);
    });
    categoriaLabel.appendChild(categoriaSelect);

    const precoLabel = document.createElement("label");
    precoLabel.textContent = "Preço";
    const precoInput = document.createElement("input");
    precoInput.name = "price";
    precoInput.type = "number";
    precoInput.min = "0";
    precoInput.step = "0.01";
    precoInput.value = formatarPreco(produto.price).replace(",", ".");
    precoInput.required = true;
    precoLabel.appendChild(precoInput);

    const imagemLabel = document.createElement("label");
    imagemLabel.textContent = "Imagem";
    const imagemInput = document.createElement("input");
    imagemInput.name = "image";
    imagemInput.type = "file";
    imagemInput.accept = "image/png,image/jpeg,image/webp";
    imagemLabel.appendChild(imagemInput);

    campos.append(nomeLabel, categoriaLabel, precoLabel, imagemLabel);

    const acoes = document.createElement("div");
    acoes.className = "acoes-produto";

    const botao = document.createElement("button");
    botao.type = "submit";
    botao.textContent = "Salvar";

    const status = document.createElement("span");
    status.className = "status";

    acoes.append(botao, status);
    form.append(preview, campos, acoes);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const status = form.querySelector(".status");
        const data = new FormData(form);
        status.textContent = "Salvando...";

        try {
            const imageFile = data.get("image");
            const body = {
                name: data.get("name"),
                category: data.get("category"),
                price: Number(data.get("price")),
                image: await arquivoParaBase64(imageFile && imageFile.size ? imageFile : null),
            };

            const resposta = await fetch(`${API_URL}/api/products/${produto.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!resposta.ok) {
                const erro = await resposta.json();
                throw new Error(erro.message);
            }

            const atualizado = await resposta.json();
            form.querySelector("img").src = atualizado.image;
            status.textContent = "Salvo";
        } catch (error) {
            status.textContent = error.message || "Erro ao salvar";
        }
    });

    return form;
}

async function carregarProdutosAdmin() {
    const resposta = await fetch(`${API_URL}/api/products`);
    const produtos = await resposta.json();
    produtosAdmin.innerHTML = "";
    produtos.forEach(produto => produtosAdmin.appendChild(criarProdutoForm(produto)));
}

async function fazerLogin(event) {
    event.preventDefault();
    loginMensagem.textContent = "Entrando...";

    try {
        const resposta = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario: document.getElementById("usuario").value.trim(),
                senha: document.getElementById("senha").value.trim(),
            }),
        });

        if (!resposta.ok) {
            throw new Error("Usuário ou senha inválidos.");
        }

        const data = await resposta.json();
        token = data.token;
        localStorage.setItem("adminToken", token);
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await carregarProdutosAdmin();
    } catch (error) {
        loginMensagem.textContent = error.message === "Failed to fetch"
            ? "Abra pelo servidor Node do projeto."
            : error.message;
    }
}

loginForm.addEventListener("submit", fazerLogin);

if (token) {
    loginPanel.hidden = true;
    adminPanel.hidden = false;
    carregarProdutosAdmin();
}
