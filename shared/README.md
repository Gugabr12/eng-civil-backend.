# shared

**Código compartilhado entre todos os backends.** Não é um serviço: não sobe, não tem porta, não tem `.env`.

É importado por caminho relativo (`../../shared/...`), não publicado como pacote npm.

---

## O que tem aqui

| Pasta | O que é | Por que é compartilhado |
|---|---|---|
| `models/` | Schemas Mongoose de todas as coleções | Vários serviços leem as mesmas coleções. Duplicar schema é garantir divergência. |
| `repositories/db.js` | Wrapper de acesso ao Mongo | Padroniza query, paginação e agregação em todos os serviços |
| `constants/` | Listas fechadas: permissões, status de tarefa, gatilhos de automação, identidade visual | Precisam ter o mesmo valor em todo lugar |
| `helpers/` | Utilitários puros: data, token, assinatura, documento | Funções sem estado, usadas por todos |
| `middlewares/servico.js` | Autenticação serviço-a-serviço (`SERVICO_SECRET`) | O mesmo aperto de mão em todas as APIs internas |
| `services/crypto/` | Criptografia de credenciais gravadas no banco | Quem grava e quem lê precisam do mesmo algoritmo |
| `services/lock.js` | Lock distribuído via MongoDB | Evita execução duplicada entre réplicas |

---

## Os models são o contrato entre os serviços

Este é o ponto mais importante do diretório.

Cada serviço registra em `configs/models.js` **apenas os models que usa** — mas todos apontam para o mesmo arquivo aqui. Então:

- **Mudar um schema afeta todos os serviços de uma vez.** Adicionar campo é seguro; remover ou renomear quebra quem ainda lê o nome antigo.
- Antes de alterar, procure quem usa: `grep -rn "NomeDoModel" backend/ --include='*.js'`
- Model não registrado em um serviço não quebra o boot, mas a query contra ele falha em runtime. Se adicionar um model novo, registre-o nos serviços que vão usá-lo.

---

## Convenção de camadas

O `shared` respeita a mesma regra dos serviços: **nada aqui acessa a rede ou tem regra de negócio de um domínio específico**. Se uma função só serve a um serviço, ela pertence ao `services/` dele, não aqui.

O critério para promover algo ao `shared` é simples: **dois ou mais serviços precisam do mesmo comportamento e divergir seria um bug.**
