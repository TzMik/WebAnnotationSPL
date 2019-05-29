const Toolset = require('../contentScript/Toolset')
const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../utils/Alerts')
const LanguageUtils = require('../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const Config = require('../Config')
const FileSaver = require('file-saver')
const Events = require('../contentScript/Events')

//let swal = require('sweetalert2')

class ToolsetBar extends Toolset{
  init() {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Toolset'
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')

      

      // Set delete annotations image and event
      let deleteAnnotationsImageURL = chrome.extension.getURL('/images/deleteAnnotations.png')
      this.deleteAnnotationsImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.deleteAnnotationsImage.src = deleteAnnotationsImageURL
      this.deleteAnnotationsImage.title = 'Delete all annotations'
      this.toolsetBody.appendChild(this.deleteAnnotationsImage)
      this.deleteAnnotationsImage.addEventListener('click', () => {
        this.deleteAnnotations()
      })



    })
  }



  deleteAnnotations () {
    // Ask user if they are sure to delete it
    Alerts.confirmAlert({
      alertType: Alerts.alertType.question,
      title: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationTitle'),
      text: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationMessage'),
      callback: (err, toDelete) => {
        // It is run only when the user confirms the dialog, so delete all the annotations
        if (err) {
          // Nothing to do
        } else {
          // Dispatch delete all annotations event
          LanguageUtils.dispatchCustomEvent(Events.deleteAllAnnotations)
          // TODO Check if it is better to maintain the sidebar opened or not
          window.abwa.sidebar.openSidebar()
        }
      }
    })
  }




  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = ToolsetBar