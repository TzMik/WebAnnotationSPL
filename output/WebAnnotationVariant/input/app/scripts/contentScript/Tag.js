const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')

class Tag {
  constructor (config/**/) {
    //
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    //
    if (config.options && config.options.color) {
      if (!ColorUtils.hasAlpha(config.options.color)) {
        this.color = ColorUtils.setAlphaToColor(config.options.color, 0.5) // Set a 0.5 alpha to all colors without alpha
      } else {
        this.color = config.options.color
      }
    } else {
      this.color = ColorUtils.getHashColor(this.name)
    }
    this.options = config.options
  }

  //

  getColor () {
    return this.color
  }

  static getInstance (tagObject, group) {
    let tag = new Tag({
      name: tagObject.name,
      namespace: tagObject.namespace,
      options: tagObject.options
    })
    tag.group = group
    tag.color = tagObject.color
    tag.tags = tagObject.tags
    return tag
  }
}

Tag.roles = {
    //*//*
}