import 'chromereload/devonly'
//PVSCL:IFCOND(NOT(Moodle), LINE)
chrome.runtime.onInstalled.addListener((details) => {
  console.log('previousVersion', details.previousVersion)
})
//PVSCL:ENDCOND
chrome.tabs.onUpdated.addListener((tabId/*PVSCL:IFCOND(NOT(Moodle))*/, changeInfo, tab/*PVSCL:ENDCOND*/) => {
  chrome.pageAction.show(tabId)
})
chrome.tabs.onCreated.addListener((tab) => {
  // Retrieve saved clicked doi element
})
const HypothesisManager = require('./background/HypothesisManager')
const Popup = require('./popup/Popup')
//PVSCL:IFCOND(Spreadsheet, LINE)
const GoogleSheetsManager = require('./background/GoogleSheetsManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(DOI, LINE)
const DoiManager = require('./background/DoiManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Moodle, LINE)
const MoodleDownloadManager = require('./background/MoodleDownloadManager')
const MoodleBackgroundManager = require('./background/MoodleBackgroundManager')
const TaskManager = require('./background/TaskManager')
//PVSCL:ENDCOND

const _ = require('lodash')

class Background {
  constructor () {
    this.hypothesisManager = null
    this.tabs = {}
  }
  init () {
    // Initialize hypothesis manager
    this.hypothesisManager = new HypothesisManager()
    this.hypothesisManager.init()
    //PVSCL:IFCOND(Spreadsheet, LINE)
    // Initialize google sheets manager
    this.googleSheetsManager = new GoogleSheetsManager()
    this.googleSheetsManager.init()
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(DOI, LINE)
    // Initialize doi manager
    this.doiManager = new DoiManager()
    this.doiManager.init()
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(Moodle, LINE)
    // Initialize moodle download manager
    this.moodleDownloadManager = new MoodleDownloadManager()
    this.moodleDownloadManager.init()
    // Initialize moodle background manager
    this.moodleBackgroundManager = new MoodleBackgroundManager()
    this.moodleBackgroundManager.init()
    // Initialize task manager
    this.taskManager = new TaskManager()
    this.taskManager.init()
    //PVSCL:ENDCOND
    // Initialize page_action event handler
    chrome.pageAction.onClicked.addListener((tab) => {
      if (this.tabs[tab.id]) {
        if (this.tabs[tab.id].activated) {
          this.tabs[tab.id].deactivate()
        } else {
          this.tabs[tab.id].activate()
        }
      } else {
        this.tabs[tab.id] = new Popup()
        this.tabs[tab.id].activate()
      }
    })
    // On tab is reloaded
    chrome.tabs.onUpdated.addListener((tabId) => {
      if (this.tabs[tabId]) {
        if (this.tabs[tabId].activated) {
          this.tabs[tabId].activate()
        }
      } else {
        this.tabs[tabId] = new Popup()
      }
    })
    // Initialize message manager
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'whoiam') {
          sendResponse(sender)
        } else if (request.cmd === 'deactivatePopup') {
          if (!_.isEmpty(this.tabs) && !_.isEmpty(this.tabs[sender.tab.id])) {
            this.tabs[sender.tab.id].deactivate()
          }
          sendResponse(true)
        } else if (request.cmd === 'activatePopup') {
          if (!_.isEmpty(this.tabs) && !_.isEmpty(this.tabs[sender.tab.id])) {
            this.tabs[sender.tab.id].activate()
          }
          sendResponse(true)
        } else if (request.cmd === 'amIActivated') {
          if (this.tabs[sender.tab.id].activated) {
            sendResponse({activated: true})
          } else {
            sendResponse({activated: false})
          }
        }
      }
    })
  }
}

window.background = new Background()
window.background.init()