const busca = document.getElementById("busca");
const categoria = document.getElementById("categoria");
const cardapio = document.getElementById("cardapio");
const API_URL = window.location.origin;

const categorias = {
    suinos: "Suínos",
    bovinos: "Bovinos",
    ovinos: "Ovinos",
    outros: "Outros",
};

let produtos = [];

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function criarCard(produto) {
    const card = document.createElement("div");
    card.className = "menu-card";
    card.dataset.categoria = produto.category;

    const info = document.createElement("div");
    info.className = "menu-info";

    const nome = document.createElement("h3");
    nome.textContent = produto.name;

    const preco = document.createElement("strong");
    preco.textContent = formatarPreco(produto.price);

    const imagem = document.createElement("img");
    imagem.src = produto.image;
    imagem.alt = produto.name;

    info.append(nome, preco);
    card.append(info, imagem);

    return card;
}

function renderizarProdutos() {
    const texto = busca.value.toLowerCase();
    const categoriaSelecionada = categoria.value;

    cardapio.innerHTML = "";

    Object.entries(categorias).forEach(([valor, titulo]) => {
        const produtosFiltrados = produtos.filter(produto => {
            const combinaBusca = produto.name.toLowerCase().includes(texto);
            const combinaCategoria = categoriaSelecionada === "todos" || produto.category === categoriaSelecionada;
            return produto.category === valor && combinaBusca && combinaCategoria;
        });

        if (produtosFiltrados.length === 0) {
            return;
        }

        const bloco = document.createElement("div");
        bloco.className = "categoria-bloco";

        const heading = document.createElement("h2");
        heading.className = "categoria-titulo";
        heading.textContent = titulo;

        const menu = document.createElement("div");
        menu.className = "menu";

        produtosFiltrados.forEach(produto => menu.appendChild(criarCard(produto)));
        bloco.append(heading, menu);
        cardapio.appendChild(bloco);
    });
}

async function carregarProdutos() {
    try {
        const resposta = await fetch(`${API_URL}/api/products`);
        produtos = await resposta.json();
        renderizarProdutos();
    } catch (error) {
        cardapio.innerHTML = "<p class=\"mensagem-status\">Não foi possível carregar o cardápio.</p>";
    }
}

busca.addEventListener("input", renderizarProdutos);
categoria.addEventListener("change", renderizarProdutos);
carregarProdutos();
