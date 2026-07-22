# Testar antes de publicar

Não abra o `index.html` com duplo clique, porque o navegador pode bloquear a leitura do JSON local.

Na pasta do projeto, abra o terminal e execute:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

Para testar novamente o cadastro, apague no navegador os dados do site ou execute no Console:

```js
localStorage.removeItem("tri_ai_bubble_lead");
localStorage.removeItem("tri_ai_bubble_access");
location.reload();
```
