const Events = {
  annotate: 'annotate',
  annotationCreated: 'annotationCreated',
  annotationDeleted: 'annotationDeleted',
  //PVSCL:IFCOND(Validations)
  annotationValidated: 'annotationValidated',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Marks)
  mark: 'mark',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(ModeSelector)
  modeChanged: 'modeChanged',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(UserFilter)
  userFilterChange: 'userFilterChange',
  //PVSCL:ENDCOND
  updatedCurrentAnnotations: 'updatedCurrentAnnotations',
  updatedDocumentURL: 'updatedDocumentURL',
  //PVSCL:IFCOND(Comments)
  comment: 'annotationComment',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Replys)
  reply: 'reply',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(AllDeleter)
  tagsUpdated: 'tagsUpdated',
  deleteAllAnnotations: 'deleteAllAnnotations',
  deletedAllAnnotations: 'deletedAllAnnotations',
  //PVSCL:ENDCOND
  updatedAllAnnotations: 'updatedAllAnnotations'
}