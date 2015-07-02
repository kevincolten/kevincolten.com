Backbone.GistModel = Backbone.Model.extend({
    urlRoot: 'https://api.github.com/gists/',
    idAttribute: 'id'
});

Backbone.GistsCollection = Backbone.Collection.extend({
    url: 'https://api.github.com/users/mistakevin/gists',
    model: Backbone.GistModel
});