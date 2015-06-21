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

Backbone.PostItemView = Backbone.Layout.extend({
    template: _.template('<div class="post"> \
                <a href="#" data-action="view-post-detail"> \
                    <h5><%= description.replace("@post ", "") %></h5> \
                <a/> \
                <div id="post-<%= id %>"></div> \
            </div>'),

    events: {
        'click [data-action="view-post-detail"]': 'viewPostDetail',
        'click [data-action="close-post-detail"]': 'closePostDetail'
    },

    viewPostDetail: function(e)
    {
        $(e.currentTarget).attr('data-action', 'close-post-detail');
        var that = this;
        this.postDetailView = new Backbone.PostDetailView({
            model: this.model
        });
        this.setView('#post-' + this.model.id, that.postDetailView);
        this.model.fetch({
            success: function() {
                that.postDetailView.render();
            }
        });
    },

    closePostDetail: function(e)
    {
        $(e.currentTarget).attr('data-action', 'view-post-detail');
        this.removeView(this.postDetailView);
    }

});

Backbone.PostDetailView = Backbone.Layout.extend({
    template: _.template('<div class="post-description"> \
                <span><%= marked(files[Object.keys(files)[0]].content) %></span> \
            </div>'),
});