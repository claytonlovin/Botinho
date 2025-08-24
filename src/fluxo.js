// src/fluxo.js
const repo = require('../database/fluxoRepository');

let fluxoCache = null; // guarda o fluxo carregado

async function carregarFluxo() {
  if (!fluxoCache) {
    fluxoCache = await repo.getFluxoAsync();
  }
  return fluxoCache;
}

function setFluxo(novoFluxo) {
  fluxoCache = novoFluxo;
}

module.exports = { carregarFluxo, setFluxo };
