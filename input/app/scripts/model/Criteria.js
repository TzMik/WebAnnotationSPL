const GuideElement = require('./GuideElement')
const jsYaml = require('js-yaml')
const _ = require('lodash')
const Level = require('./Level')
const LanguageUtils = require('../utils/LanguageUtils')

class Criteria extends GuideElement {
  constructor ({ name, color/*PVSCL:IFCOND(Moodle)*/, criteriaId, rubric /*PVSCL:ELSEIFCOND(DefaultCriterias)*/, review, group = 'Other', description, custom = false /*PVSCL:ENDCOND*/}) {
    super ({name, color, parentElement: /*PVSCL:IFCOND(Moodle)*/ rubric /*PVSCL:ELSEIFCOND(DefaultCriterias)*/ review /*PVSCL:ENDCOND*/})
    this.levels = this.childElements
    //PVSCL:IFCOND(Moodle)
    this.criteriaId = criteriaId
    this.rubric = this.parentElement
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(DefaultCriterias)
    this.group = group
    this.review = this.parentElement
    this.description = description
    this.custom = custom
    //PVSCL:ENDCOND
  }

  toAnnotations () {
    let annotations = []
    // Create its annotations
    annotations.push(this.toAnnotation())
    // Create its children annotations
    for (let i = 0; i < this.levels.length; i++) {
      annotations = annotations.concat(this.levels[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    //PVSCL:IFCOND(Moodle)
    let rubric = this.getAncestor()
    return {
      group: rubric.hypothesisGroup.id,
      permissions: {
        read: ['group:' + rubric.hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:criteria:' + LanguageUtils.normalizeString(this.name), 'exam:cmid:' + rubric.cmid],
      target: [],
      text: jsYaml.dump({criteriaId: this.criteriaId}),
      uri: rubric.hypothesisGroup.links ? rubric.hypothesisGroup.links.html : rubric.hypothesisGroup.url // Compatibility with both group representations getGroups and userProfile
    }
    //PVSCL:ELSEIFCOND(DefaultCriterias)
    let review = this.getAncestor()
    return {
      group: review.hypothesisGroup.id,
      permissions: {
        read: ['group:' + review.hypothesisGroup.id]
      },
      references: [],
      tags: ['review:criteria:' + LanguageUtils.normalizeString(this.name)],
      target: [],
      text: jsYaml.dump({
        description: this.description,
        group: this.group,
        custom: this.custom
      }),
      uri: review.hypothesisGroup.links ? review.hypothesisGroup.links.html : review.hypothesisGroup.url // Compatibility with both group representations getGroups and userProfile
    }
    //PVSCL:ENDCOND
  }

  static fromAnnotations (annotations) {
  }
  
  static fromAnnotation (annotation, rubric = {}) {
    let criteriaTag = _.find(annotation.tags, (tag) => {
      return tag.includes('exam:criteria:')
    })
    if (_.isString(criteriaTag)) {
      let name = criteriaTag.replace('exam:criteria:', '')
      let config = jsYaml.load(annotation.text)
      if (_.isObject(config)) {
        let criteriaId = config.criteriaId
        return new Criteria({name, criteriaId, rubric})
      } else {
      }
    } else {
      console.error('Unable to retrieve criteria from annotation')
    }
  }
  
  static createCriteriaFromObject (criteria, rubric) {
    criteria.parentElement = rubric
    criteria.rubric = criteria.parentElement
    // Instance criteria object
    let instancedCriteria = Object.assign(new Criteria({}), criteria)
    // Instance levels
    for (let i = 0; i < criteria.levels.length; i++) {
      instancedCriteria.levels[i] = Level.createLevelFromObject(criteria.levels[i], instancedCriteria)
    }
    return instancedCriteria
  }
}

module.exports = Criteria