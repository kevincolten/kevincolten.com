Backbone.PostItemView = Backbone.Layout.extend({
    template: 'PostItemTemplate.html',

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
    },

    serialize: function()
    {
        return {
            post: this.model
        };
    }
});
