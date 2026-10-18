// Hook PreToolUse: bloquea herramientas que apunten a .env o a archivos de claves (leer, escribir, listar o
// usarlos en un comando). Solo mira rutas y comandos, no el contenido que se escribe, así que documentar
// variables en .env.example, CLAUDE.md o .gitignore sigue permitido. Sale con 2 para bloquear.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try { input = JSON.parse(raw.replace(/^﻿/, "")); } catch {
    process.stderr.write("protect-secrets: entrada JSON inválida; herramienta bloqueada.\n");
    process.exit(2);
  }
  const ti = input?.tool_input ?? {};
  const targets = [ti.file_path, ti.path, ti.notebook_path, ti.command];
  if (input?.tool_name === "Glob") targets.push(ti.pattern);
  const text = targets.filter((v) => typeof v === "string").join("\n");

  const envFile = /(^|[\s"'`=\/\\(:])\.env(?!\.example(?=$|[\s"'`;|&),]))(\.[\w.-]+)?(?=$|[\s"'`;|&)\/\\,*])/im;
  const keyFile = /\.(pem|key|p12|pfx)(?=$|[\s"'`;|&)])/im;
  const sshKey = /(^|[\s"'`=\/\\(:])id_(rsa|ed25519|ecdsa|dsa)(?=$|[\s"'`;|&)])/im;
  if (envFile.test(text) || keyFile.test(text) || sshKey.test(text)) {
    process.stderr.write(
      "Bloqueado por protect-secrets: los agentes no pueden leer, escribir ni usar .env ni archivos de claves. " +
      "Las claves las gestiona el usuario en local. Documenta variables nuevas en .env.example.\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
