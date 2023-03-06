// ==UserScript==
// @name         JVjai1vie
// @namespace    https://alois.xyz/
// @version      0.3
// @description  Notif sur mention
// @author       bahlang
// @match        https://www.jeuxvideo.com/forums/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=jeuxvideo.com
// @grant        none
// ==/UserScript==


let msgs = []
let resps = []
let ignoreMsgs = []

async function makeDomRequest(url) {
    let r = await fetch(url)
    let t = await r.text()
    return new DOMParser().parseFromString(t, 'text/html')
}

function levenshtein(str1, str2) {
   const track = Array(str2.length + 1).fill(null).map(() =>
   Array(str1.length + 1).fill(null));
   for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
   }
   for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
   }
   for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
         const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
         track[j][i] = Math.min(
            track[j][i - 1] + 1, // deletion
            track[j - 1][i] + 1, // insertion
            track[j - 1][i - 1] + indicator, // substitution
         );
      }
   }
   return track[str2.length][str1.length];
}

function addNotification(e) {
    let cont = document.querySelector("#JV_MENTIONS_notifs")
    let notif = document.createElement("div")
    notif.setAttribute("class", "headerAccount__dropdownItem"+ (e.read ? "" : " headerAccount__dropdownItem--unread js-header-unread"))

    notif.innerHTML = `
    <span class="headerAccount__dropdownAvatar" style="background-image:url('${e.image}')"></span><div class="headerAccount__dropdownDetails"><span class="headerAccount__dropdownSubInfo headerAccount__dropdownSubInfo--author">
                            <em>${e.pseudo}</em> t'as répondu
                        </span><a href="${e.link}" class="headerAccount__dropdownItemLabel stretched-link js-header-open-notif">
                        <em>${e.pseudo}</em> t'as répondu dans le topic <em>${e.topic}</em>
                    </a></div><span class="headerAccount__dropdownSubInfo"><span class="headerAccount__dropdownSubInfoDate">${e.date}</span></span>
   `
    notif.onclick = ()=> {
        let nreps = []
        resps.forEach(r => {
            if (r.id == e.id) {
                let ne = e
                ne.read = true
                nreps.push(ne)
            } else {
                nreps.push(r)
            }
        })
        resps = nreps
        window.localStorage.setItem("JV_MENTIONS_resps", JSON.stringify(resps))
    }
    cont.insertBefore(notif, cont.firstChild)

    if (!e.read) {
        document.querySelector(".headerAccount__pm").classList.add("headerAccount__pm--hasNotif")
    }
}


(function() {
    'use strict';

    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").parentNode.style.overflowY = "auto"
    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").style.position = "initial"
    document.querySelector(".headerAccount__harassmentWarning").parentNode.style.display = "none"
    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").parentNode.querySelector(".headerAccount__dropdownContainerTop").innerHTML += "<hr><div id=\"JV_MENTIONS_notifs\"><p>Fin des réponses.</p></div>"
    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").parentNode.querySelector(".headerAccount__dropdownContainerTop").style.height = "auto"

    if (window.localStorage.getItem("JV_MENTIONS_msgs")) {
        msgs = JSON.parse(window.localStorage.getItem("JV_MENTIONS_msgs"))
    }

    if (window.localStorage.getItem("JV_MENTIONS_ignore")) {
        ignoreMsgs = JSON.parse(window.localStorage.getItem("JV_MENTIONS_ignore"))
    }

    if (window.localStorage.getItem("JV_MENTIONS_resps")) {
        resps = JSON.parse(window.localStorage.getItem("JV_MENTIONS_resps"))
        resps.forEach(e=>{
            addNotification(e)
        })
    }

    let pseudo = document.querySelector(".headerAccount__pseudo").innerText

    document.querySelectorAll(".conteneur-message .bloc-header").forEach(e => {
        if (e.querySelector(".bloc-pseudo-msg").innerText != pseudo) {
            return
        }
        let msg = e.querySelector(".bloc-date-msg").innerText
        let found = false
        msgs.forEach(m=>{
            if (m.id == msg) {
                found = true
            }
        })
        if (!found) {
            msgs.push({
                id: msg,
                contents: e.parentElement.querySelector(".bloc-contenu .txt-msg").innerText.replace(/\s+/igm, ' '),
                topic: document.querySelector("#bloc-title-forum"),
                date: Date.now()
            })
        }
        let nmsgs = []
        msgs.forEach(m => {
            if (m.date - Date.now() < 10800000) {
                nmsgs.push(m)
            }
        })
        msgs = nmsgs
        window.localStorage.setItem("JV_MENTIONS_msgs", JSON.stringify(msgs))
    })

    setInterval(()=>{
        msgs.forEach(m => {
            let req = "Le "+m.id + " " + (m.contents.replace(/\n/igm, ' ').substr(0, 50))
            req = req.replace(/(\d{2}):\d{2}:(\d{2})/igm, "$1$2")
            req = req.replace(/(.*) \w*/igm, '$1')
            req = req.replace(/\s/igm, '+')
            console.log(req)
            makeDomRequest("https://www.jeuxvideo.com/recherche/forums/0-51-0-1-0-1-0-blabla-18-25-ans.htm?search_in_forum="+req+"&type_search_in_forum=texte_message").then(doc => {
                let hasRep = false
                doc.querySelectorAll(".message .topic-title").forEach(e=>{
                    hasRep = true
                    let found = false
                    let mid = e.getAttribute("href").split("#post_")[1]
                    resps.forEach(r=>{
                        if (r.id == mid) {
                            found = true
                        }
                    })
                    if (found) {
                        return
                    }
                    if (ignoreMsgs.includes(mid)) {
                        return
                    }
                    ignoreMsgs.push(mid)
                    console.log("making message request")
                    makeDomRequest("https://www.jeuxvideo.com/forums/message/"+mid).then(msgDoc => {
                        msgDoc.querySelectorAll(".blockquote-jv").forEach(q=>{
                            let msgBody = q.innerText.split(":").slice(3).join(":").replace(/\s+/igm, ' ')
                            console.log(levenshtein(msgBody, m.contents))
                            console.log(m.contents)
                            console.log(msgBody)
                            if (levenshtein(msgBody, m.contents) < 3) {
                                console.log("Found!")
                                let not = {
                                    id: mid,
                                    link: msgDoc.querySelector(".bloc-return-topic a").getAttribute("href"),
                                    image: msgDoc.querySelector(".user-avatar-msg").getAttribute("data-src"),
                                    topic: msgDoc.querySelectorAll("a.breadcrumb__item")[msgDoc.querySelectorAll("a.breadcrumb__item").length-1].innerText.substr(6),
                                    date: msgDoc.querySelector(".bloc-date-msg").innerText,
                                    pseudo: msgDoc.querySelector(".bloc-pseudo-msg").innerText,
                                    read: false
                                }
                                resps.push(not)
                                addNotification(not)
                                window.localStorage.setItem("JV_MENTIONS_resps", JSON.stringify(resps))
                            }
                        })
                    })
                    })
                if (!hasRep) {
                    let nmsgs = []
                    msgs.forEach(mi => {
                        if (mi.id != m.id) {
                            nmsgs.push(m)
                        }
                    })
                    msgs = nmsgs
                    window.localStorage.setItem("JV_MENTIONS_msgs", JSON.stringify(msgs))
                }
            })
        })
    }, 10000)


})();
