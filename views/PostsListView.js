Backbone.PostsListView = Backbone.Layout.extend({
  template: _.template('<div id="posts"></div>'),

  beforeRender: function()
  {
    this.collection.each(function (post) {
        this.insertView(new Backbone.PostItemView({
            model: post
        }));
    }, this);
  }
});
