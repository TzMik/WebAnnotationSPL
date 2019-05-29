const $ = require('jquery')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const Events = require('./Events')
//PVSCL:IFCOND(Student AND Teacher, LINE)
const RolesManager = require('./RolesManager')
//PVSCL:ENDCOND

class ModeManager {
  constructor (mode) {
    if (mode) {
      this.mode = mode
    }
  }

  init (callback) {
    //PVSCL:IFCOND(Teacher, LINE)
    if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
    // PVSCL:ENDCOND
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      //PVSCL:IFCOND(IndexMode, LINE)
      this.mode = ModeManager.modes.index
      //PVSCL:ENDCOND
      //PVSCL:IFCOND(MarkingMode, LINE)
      this.mode = ModeManager.modes.mark
      //PVSCL:ENDCOND
      // Open sidebar
      window.abwa.sidebar.openSidebar()
    } else {
      //PVSCL:IFCOND(HighlightMode, LINE)
      this.mode = ModeManager.modes.highlight
      //PVSCL:ENDCOND
      //PVSCL:IFCOND(EvidencingMode OR ReviewMode, LINE)
      this.mode = ModeManager.modes.evidencing
      //PVSCL:ENDCOND
    }
    this.loadSidebarToggle(() => {
      this.initEventHandlers(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
    //PVSCL:IFCOND(Teacher, LINE)
    } else {
      this.mode = ModeManager.modes.view
      if (_.isFunction(callback)) {
        callback()
      }
    }
    //PVSCL:ENDCOND
  }
  //PVSCL:IFCOND((ReviewMode AND IndexMode) OR (HighlightMode AND IndexMode), LINE)
  loadSidebarToggle (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/annotatorMode.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      // Set toggle status
      this.setToggleStatus()
      // Set tags text
      this.setPanelText()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setToggleStatus () {
    //PVSCL:IFCOND(HighlightMode AND IndexMode, LINE)
    if (this.mode === ModeManager.modes.highlight) {
      this.setHighlightMode()
    } else {
      this.setIndexMode()
    }
    //PVSCL:ELSEIFCOND(MarkingMode AND EvidencingMode, LINE)
    if (this.mode === ModeManager.modes.evidencing) {
      this.setEvidencingMode()
    } else {
      this.setMarkingMode()
    }
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(ReviewMode AND IndexMode, LINE)
    if (this.mode === ModeManager.modes.evidencing) {
      this.setEvidencingMode()
    } else {
      this.setIndexMode()
    }
    //PVSCL:ENDCOND
  }
  //PVSCL:ENDCOND
  setPanelText () {
    // Mode element
    let modeHeaderLabel = document.querySelector('#modeHeader label')
    modeHeaderLabel.innerText = chrome.i18n.getMessage('Mode')
    let modeLabel = document.querySelector('#modeLabel')
    //PVSCL:IFCOND((HighlightMode OR ReviewMode) AND IndexMode, LINE)
    if (this.mode === ModeManager.modes.highlight) {
      //PVSCL:IFCOND(HighlightMode, LINE)
      modeLabel.innerText = chrome.i18n.getMessage('highlight')
      //PVSCL:ELSEIFCOND(ReviewMode)
      modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
      //PVSCL:ENDCOND
    } else {
      modeLabel.innerText = chrome.i18n.getMessage('index')
    }
    //PVSCL:ELSEIFCOND(MarkingMode AND EvidencingMode, LINE)
    if (this.mode === ModeManager.modes.evidencing) {
      modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
    } else {
      modeLabel.innerText = chrome.i18n.getMessage('Marking')
    }
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(HighlightMode, LINE)
  setHighlightMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = true
    modeLabel.innerText = chrome.i18n.getMessage('highlight')
    this.mode = ModeManager.modes.highlight
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(EvidencingMode OR ReviewMode, LINE)
  setEvidencingMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = false
    modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
    this.mode = ModeManager.modes.evidencing
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(IndexMode, LINE)
  setIndexMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = false
    modeLabel.innerText = chrome.i18n.getMessage('index')
    this.mode = ModeManager.modes.index
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(MarkingMode, LINE)
  setMarkingMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = true
    modeLabel.innerText = chrome.i18n.getMessage('Marking')
    this.mode = ModeManager.modes.mark
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(Student, LINE)
  setViewingMode () {
    this.mode = ModeManager.modes.view
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(NOT(ReviewMode) OR ((ReviewMode OR HighlightMode) AND IndexMode), LINE)
  initEventHandlers (callback) {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    annotatorToggle.addEventListener('click', (event) => {
      if (annotatorToggle.checked) {
        //PVSCL:IFCOND(HighlightMode, LINE)
        this.setHighlightMode()
        //PVSCL:ELSEIFCOND(MarkingMode, LINE)
        this.setMarkingMode()
        //PVSCL:ELSEIFCOND(ReviewMode)
        this.setEvidencingMode()
        //PVSCL:ENDCOND
      } else {
        //PVSCL:IFCOND(IndexMode, LINE)
        this.setIndexMode()
        //PVSCL:ELSEIFCOND(EvidencingMode, LINE)
        this.setEvidencingMode()
        //PVSCL:ENDCOND
      }
      LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
    })
    if (_.isFunction(callback)) {
      callback()
    }
  }
  //PVSCL:ENDCOND
}

ModeManager.modes = {
  //PVSCL:IFCOND(HighlightMode, LINE)
  'highlight': 'highlight',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(MarkingMode, LINE)
  'mark': 'mark',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(EvidencingMode OR ReviewMode, LINE)
  'evidencing': 'evidencing',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(IndexMode, LINE)
  'index': 'index'
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Student, LINE)
  'view': 'view'
  //PVSCL:ENDCOND
}

module.exports = ModeManager