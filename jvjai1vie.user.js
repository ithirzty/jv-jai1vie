// ==UserScript==
// @name         JVjai1vie
// @namespace    https://alois.xyz/
// @version      0.94
// @description  Notif sur mention
// @author       bahlang
// @match        https://www.jeuxvideo.com/forums/*
// @downloadURL  https://github.com/ithirzty/jv-jai1vie/raw/main/jvjai1vie.user.js
// @updateURL    https://github.com/ithirzty/jv-jai1vie/raw/main/jvjai1vie.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=jeuxvideo.com
// @grant        none
// ==/UserScript==


let msgs = []
let resps = []
let ignoreMsgs = []
let currIndex = 0
let rateLimited = false

async function makeDomRequest(url) {
    let r = await fetch(url)
    if (r.status != 200) {
        return null
    }
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
                            <em>${e.topic}
                        </span><a href="${e.link}" class="headerAccount__dropdownItemLabel stretched-link js-header-open-notif">
                        <em>${e.pseudo}</em> t'a répondu.
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
    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").parentNode.querySelector(".headerAccount__dropdownContainerTop").innerHTML += "<hr><div style=\"max-height: 350px;overflow: auto;\" id=\"JV_MENTIONS_notifs\"><p>Fin des réponses. (status: <span id=\"JV_MENTIONS_status\">normal</span>)</p></div>"
    document.querySelector(".headerAccount__dropdownContainerContent[data-type=mp]").parentNode.querySelector(".headerAccount__dropdownContainerTop").style.height = "auto"

    document.querySelector(".headerAccount__pm").addEventListener("click", ()=>{
        resps.forEach(m => {
            m.read = true
        })
        window.localStorage.setItem("JV_MENTIONS_resps", JSON.stringify(resps))
    }, false)

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
            console.log("adding")
            msgs.push({
                id: msg,
                contents: e.parentElement.querySelector(".bloc-contenu .txt-msg").innerText.replace(/ +/igm, ' ').replace(/ *: */igm, ':'),
                topic: document.querySelector("#bloc-title-forum").innerText,
                noReps: 0,
                date: Date.now()
            })
        }
        window.localStorage.setItem("JV_MENTIONS_msgs", JSON.stringify(msgs))
    })

    setInterval(()=>{
        if (rateLimited) {
            rateLimited = false
            console.log("skipping one round")
            return
        }
        for (let i = 0, j = 0; i < 3; i++, j++) {
            if (j > msgs.length) {
                break
            }
            msgs[currIndex].noReps++
            window.localStorage.setItem("JV_MENTIONS_msgs", JSON.stringify(msgs))
            let m = msgs[currIndex]
            currIndex = (currIndex + 1) % msgs.length
            if (m.noReps > 60 || Date.now() - m.date > 10800000) {
                i--
                console.log("Skipping:", m.id)
                continue
            }
            console.log("Searching:", m.id)
            let req = "Le "+m.id + " " + (m.contents.replace(/\n/igm, ' ').substr(0, 100))
            req = req.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9\(\)@:%_\+.~#?&\/=])*/igm, " ")
            req = req.replace(/\?|-/igm, ' ')
            req = req.replace(/\s+/igm, ' ')
            req = req.replace(/(\d{2}):\d{2}:(\d{2})/igm, "$1$2")
            req = req.replace(/(.*) [a-zA-Z\u00C0-\u00FF]*/igm, '$1')
            req = req.replace(/\s/igm, '+')
            console.log("Making request ("+m.noReps+"/60):", req)
            makeDomRequest("https://www.jeuxvideo.com/recherche/forums/0-51-0-1-0-1-0-blabla-18-25-ans.htm?search_in_forum="+req+"&type_search_in_forum=texte_message").then(doc => {
                if (doc == null) {
                    console.log("rate limit")
                    document.querySelector("#JV_MENTIONS_status").innerHTML = "ralenti"
                    rateLimited = true
                    currIndex--
                    i--
                    if (currIndex < 0) {
                        currIndex = msgs.length - 1
                    }
                    return
                }
                doc.querySelectorAll(".message .topic-title").forEach(e=>{
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
                    makeDomRequest("https://www.jeuxvideo.com/forums/message/"+mid).then(msgDoc => {
                        if (msgDoc == null) {
                            return
                        }
                        ignoreMsgs.push(mid)
                        msgDoc.querySelectorAll(".blockquote-jv").forEach(q=>{
                            let msgBody = q.innerText.split(":").slice(3).join(":").replace(/ +/igm, ' ').replace(/ *: */igm, ':')
                            if (msgDoc.querySelectorAll("a.breadcrumb__item")[msgDoc.querySelectorAll("a.breadcrumb__item").length-1].innerText.substr(6) != m.topic) {
                                return
                            }
                            if (msgDoc.querySelector(".bloc-pseudo-msg").innerText == pseudo) {
                                return
                            }
                            let mLookupBody = m.contents.replace(/\n/igm, '')
                            console.log(levenshtein(msgBody, mLookupBody), msgBody, mLookupBody)
                            if (levenshtein(msgBody, mLookupBody) <= 3) {
                                console.log("Found!")
                                m.noReps = 0
                                window.localStorage.setItem("JV_MENTIONS_msgs", JSON.stringify(msgs))
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
            })
        }
    window.localStorage.setItem("JV_MENTIONS_ignore", JSON.stringify(ignoreMsgs))
    }, 10000)


})();
