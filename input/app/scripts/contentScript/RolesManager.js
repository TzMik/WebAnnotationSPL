const _ = require('lodash')
const jsYaml = require('js-yaml')
const Config = require('../Config')

class RolesManager {
  constructor () {
    //PVSCL:IFCOND(Student, LINE)
    this.role = RolesManager.roles.student
    //PVSCL:ELSECOND
    this.role = RolesManager.roles.reviewer
    //PVSCL:ENDCOND
  }

  init (callback) {
    //PVSCL:IFCOND(Student, LINE)
    this.getUserRole(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
    //PVSCL:ELSECOND
    if (_.isFunction(callback)) {
      callback()
    }
    //PVSCL:ENDCOND
  }

  /**
   * Retrieve current user role
   */

  //PVSCL:IFCOND(Teacher, LINE)
  getUserRole (callback) {
    this.currentUserIsTeacher((err, isTeacher) => {
      if (err) {

      } else {
        if (isTeacher) {
          this.role = RolesManager.roles.teacher
        } else {
          this.role = RolesManager.roles.student
        }
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  currentUserIsTeacher (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'desc',
      tags: Config.exams.namespace + ':' + Config.exams.tags.statics.teacher
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (annotations.length > 0) {
          let params = jsYaml.load(annotations[0].text)
          callback(null, params.teacherId === window.abwa.groupSelector.user.userid) // Return if current user is teacher
        } else {
          if (_.isFunction(callback)) {
            callback(null)
          }
        }
      }
    })
  }
  //PVSCL:ENDCOND

  destroy () {
    this.role = null
  }
}

RolesManager.roles = {
  //PVSCL:IFCOND(Student, LINE)
  'student': 'student',
  'teacher': 'teacher'
  //PVSCL:ELSECOND
  'reviewer': 'reviewer'
  //PVSCL:ENDCOND
}

module.exports = RolesManager
