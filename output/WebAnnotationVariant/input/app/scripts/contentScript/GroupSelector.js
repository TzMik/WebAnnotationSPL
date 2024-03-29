const _ = require('lodash')
const $ = require('jquery')
//
const Alerts = require('../utils/Alerts')
//
const CryptoUtils = require('../utils/CryptoUtils')
//
//

class GroupSelector {
  constructor () {
    //
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    //
  }

  //

  defineCurrentGroup (callback) {
    //
    //
    let fileMetadata = window.abwa.contentTypeManager.fileMetadata
    // Get group name from file metadata
    let groupName = (new URL(fileMetadata.url)).host + fileMetadata.courseId + fileMetadata.studentId
    let hashedGroupName = 'MG' + CryptoUtils.hash(groupName).substring(0, 23)
    //
    // Load all the groups belonged to current user
    this.retrieveHypothesisGroups((err, groups) => {
      if (err) {
      } else {
        //
        let group = _.find(groups, (group) => { return group.name === hashedGroupName })
        //
        if (_.isObject(group)) {
          // Current group will be that group
          this.currentGroup = group
          if (_.isFunction(callback)) {
            callback(null)
          }
        } else {
          //
          // Warn user not group is defined, configure tool first
          Alerts.errorAlert({text: 'If you are a teacher you need to configure Mark&Go first.<br/>If you are a student, you need to join feedback group first.', title: 'Unable to start the application'}) // TODO i18n
          //
        }
      }
    })
    //
  }

  //
  checkIsLoggedIn (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (!window.abwa.hypothesisClientManager.isLoggedIn()) {
        // Display login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
        // Hide group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'true')
        // Hide purposes wrapper
        $('#purposesWrapper').attr('aria-hidden', 'true')
        // Start listening to when is logged in continuously
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'startListeningLogin'})
        // Open the sidebar to notify user that needs to log in
        window.abwa.sidebar.openSidebar()
        if (_.isFunction(callback)) {
          callback(new Error('Is not logged in'))
        }
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveHypothesisGroups (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getListOfGroups({}, (err, groups) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.groups = groups
        if (_.isFunction(callback)) {
          callback(null, groups)
        }
      }
    })
  }

  retrieveUserProfile (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }
  //

  destroy (callback) {
    //
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

GroupSelector.eventGroupChange = 'hypothesisGroupChanged'

module.exports = GroupSelector