var GistModel = Backbone.Model.extend({
    urlRoot: 'https://api.github.com/gists/',
    idAttribute: 'id',
});

var GistsCollection = Backbone.Collection.extend({
    url: 'https://api.github.com/users/mistakevin/gists',
    model: GistModel
});

var PostsListView = Backbone.Layout.extend({
  template: "#posts-list-template",

  beforeRender: function()
  {
    this.collection.each(function (post) {
        this.insertView(new PostItemView({
            model: post
        }));
    }, this);
  }
});

var PostItemView = Backbone.Layout.extend({
    template: "#post-item-template",

    events: {
        'click [data-action="view-post-detail"]': 'viewPostDetail',
        'click [data-action="close-post-detail"]': 'closePostDetail'
    },

    viewPostDetail: function(e)
    {
        $(e.currentTarget).attr('data-action', 'close-post-detail');
        var that = this;
        this.postDetailView = new PostDetailView({
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

var PostDetailView = Backbone.Layout.extend({
    template: "#post-detail-template",
});

var gists = new GistsCollection();

gists.fetch({
    success: function() {
        var posts = new GistsCollection(gists.filter(function (gist) {
            return gist.get('description').indexOf('@post') !== -1
        }));
        var main = new Backbone.Layout({
            template: "#main-layout",
  
            views: {
                "#content": new PostsListView({
                    collection: posts
                })
            }
        });
        main.$el.appendTo("#container");
        main.render();
    }
});