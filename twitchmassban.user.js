
// ==UserScript==
// @name          Twitch RaidHammer - Easily ban multiple accounts during hate raids
// @description   A tool for moderating Twitch easier during hate raids
// @namespace     https://github.com/geekatori/twitch-mass-ban
// @version       1.1.4.3
// @match         *://*.twitch.tv/*
// @run-at        document-idle
// @author        victornpb
// @author        geekatori
// @homepageURL   https://github.com/geekatori/twitch-mass-ban
// @grant         none
// @license       MIT
// ==/UserScript==

/* jshint esversion: 8 */

(function () {
    var html = /*html*/`
    <div class="raidhammer">
    <style>
        .raidhammer {
            position: fixed;
            bottom: 10px;
            right: 350px;
            z-index: 99999999;
            background-color: var(--color-background-base);
            color: var(--color-text-base);
            border: var(--border-width-default) solid var(--color-border-base);
            box-shadow: var(--shadow-elevation-2);
            padding: 5px;
            min-width: 300px;
        }


        .raidhammer .header {
            display: flex;
        }

        .raidhammer .logo {
            font-weight: var(--font-weight-semibold);
            min-height: 30px;
            line-height: 30px;
            --color: var(--color-text-link);
        }

        .raidhammer h6 {
            color: var(--color-hinted-grey-7);
        }

        .raidhammer h6 button {
            height: auto;
            background: none;
        }

        .raidhammer .list {
            padding: 8px;
            min-height: 8em;
            max-height: 500px;
            overflow-y: auto;
            background: var(--color-background-body);
        }

        .raidhammer .list span {
            font-weight: var(--font-weight-semibold);
        }

        .raidhammer .empty {
            padding: 2em;
            text-align: center;
            opacity: 0.85;
        }

        .raidhammer button {
            padding: 0 .5em;
            margin: 1px;
            font-weight: var(--font-weight-semibold);
            border-radius: var(--border-radius-medium);
            font-size: var(--button-text-default);
            height: var(--button-size-default);
            background-color: var(--color-background-button-secondary-default);
            color: var(--color-text-button-secondary);
            min-width: 30px;
            text-align: center;
        }

        .raidhammer button.ban {
            var(--color-text-button-primary);
            background: #f44336;
            min-width: 60px;
        }

        .raidhammer button.banAll {
            var(--color-text-button-primary);
            background: #f44336;
            min-width: 60px;
        }

        .raidhammer .import {
            background: var(--color-background-body);
            border: var(--border-width-default) solid var(--color-border-base);
            padding: 3px;
        }

        .raidhammer textarea {
            background: var(--color-background-base);
            color: var(--color-text-base);
            padding: .5em;
            font-size: 10pt;
            width: 100%;
            min-height: 8em;
        }

        .raidhammer .footer {
            font-size: 7pt;
            text-align: center;
        }
    </style>
    <div class="header">
        <span style="flex-grow: 1;"></span>
        <h5 class="logo">
            <a href="https://github.com/victornpb/twitch-mass-ban" target="_blank">RaidHammer</a>
            <samp>1.1.3</samp>
        </h5>
        <span style="flex-grow: 1;"></span>
        <button class="closeBtn">X</button>
    </div>
    <div class="import">
        <div>Mass BAN (Format: username: reason)</div> <!-- Modification ici -->
        <textarea placeholder="Type one username per line, with optional reason (username: reason)"></textarea> <!-- Nouvelle instruction -->
        <div style="text-align:right;">
            <button class="cancelBtn">Cancel</button>
            <button class="importBtn">Add to list</button>
        </div>
    </div>
    <div class="body">
        <h6>
            Usernames
        </h6>
        <div class="list"></div>
        <div style="display: flex; margin: 5px;">
            <span style="flex-grow: 1;"></span>
            <button class="banAll">Ban All</button>
        </div>
    </div>
    <div class="footer"><a href="https://github.com/geekatori/twitch-mass-ban/issues" target="_blank">Issues or help</a>
    </div>
</div>
`;
const LOGPREFIX = '[RAIDHAMMER]';

// modal
const d = document.createElement("div");
d.style.display = 'none';
d.innerHTML = html;
const textarea = d.querySelector("textarea");

// activation button
const activateBtn = document.createElement('button');
activateBtn.innerHTML = `RaidHammer`;
activateBtn.setAttribute('title', 'RaidHammer');
activateBtn.onclick = toggle;

let enabled;
let watchdogTimer;

// Ajout du bouton et de l'interface à Twitch
setInterval(appendActivatorBtn, 5000);

//events
d.querySelector(".banAll").onclick = banAll; // Suppression de l'écoute de "ignoreAll"
d.querySelector(".closeBtn").onclick = hide;

d.querySelector(".import button.importBtn").onclick = importList;
d.querySelector(".import button.cancelBtn").onclick = toggleImport;

// Traitement du contenu de la zone de texte
function importList() {
    const textarea = d.querySelector(".import textarea");
    const lines = textarea.value.split(/\n/).map(line => line.trim()).filter(Boolean);
    
    // Traitement du format 'username: reason'
    for (const line of lines) {
        const [username, reason] = line.split(':').map(part => part.trim());
        
        if (/^[\w_]+$/.test(username)) {
            // Ajouter le pseudo et la raison au format correct
            queueList.set(username, reason || "Comportement inapproprié"); // Par défaut si aucune raison n'est fournie
        }
    }
    textarea.value = '';
    toggleImport();
    renderList();
}

let queueList = new Map(); // Modification ici pour stocker les utilisateurs et leurs raisons
let bannedList = new Set();

// Bannir un utilisateur avec une raison
async function banAll() {
    console.log(LOGPREFIX, 'Banning all...', queueList);
    for (const [user, reason] of queueList.entries()) {
        banItem(user, reason);
        await delay(250); // Pause entre chaque ban
    }
}

// Mise à jour de banItem pour inclure une raison
function banItem(user, reason) {
    console.log(LOGPREFIX, 'Ban user', user, 'with reason:', reason);
    queueList.delete(user);
    bannedList.add(user);
    sendMessage(`/ban ${user} ${reason}`); // Commande avec la raison
    renderList();
}

// Fonction d'envoi du message au chat Twitch
function sendMessage(msg) {
    // Sélectionne le nouvel élément contenteditable
    const chatInput = document.querySelector("[data-a-target='chat-input']");

    if (!chatInput) {
        console.error(LOGPREFIX, 'Chat input element not found.');
        return;
    }

    // Modifie le contenu de l'élément contenteditable
    chatInput.innerHTML = `<div data-slate-node="element"><span data-slate-node="text">${msg}</span></div>`;

    // Déclenche l'événement 'input' pour simuler la saisie utilisateur
    const inputEvent = new Event('input', { bubbles: true });
    chatInput.dispatchEvent(inputEvent);

    // Sélectionne et clique sur le bouton d'envoi
    const sendButton = document.querySelector("[data-a-target='chat-send-button']");
    if (sendButton) {
        sendButton.click();
    } else {
        console.error(LOGPREFIX, 'Send button not found.');
    }
}



// Rendu de la liste d'utilisateurs à bannir avec leurs raisons
function renderList() {
    const renderItem = (user, reason) => `
    <li>
      <button class="ban" data-user="${user}" data-reason="${reason}">Ban</button>
      <span>${user} - ${reason}</span>
    </li>
  `;
    let inner = queueList.size ? [...queueList.entries()].map(([user, reason]) => renderItem(user, reason)).join('') : `
      <div class="empty">
          <h4>No users to ban :)</h4>
      </div>`;

    d.querySelector('.list').innerHTML = `
    <ul>
      ${inner}
    </ul>
  `;
}

// Append activation button to the Twitch interface
function appendActivatorBtn() {
    const parent = document.querySelector(".chat-input__buttons-container");
    if (parent && !parent.contains(activateBtn)) {
        parent.appendChild(activateBtn);
    }
}

// Toggle modal visibility
function toggle() {
    d.style.display = d.style.display === 'none' ? '' : 'none';
}

// Toggle import section visibility
function toggleImport() {
    const importSection = d.querySelector(".import");
    importSection.style.display = importSection.style.display === 'none' ? '' : 'none';
}

// Hide the modal
function hide() {
    d.style.display = 'none';
}

// Utility delay function for pauses
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add modal to document
document.body.appendChild(d);
})();