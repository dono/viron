import contains from 'mout/array/contains';
import reject from 'mout/array/reject';
import isUndefined from 'mout/lang/isUndefined';
import keys from 'mout/object/keys';
import objectReject from 'mout/object/reject';
import ObjectAssign from 'object-assign';
import { getComponentStateName } from '../../../store/states';
import '../../atoms/viron-message/index.tag';
import './filter.tag';
import './search.tag';

const STYLE_NUMBER = 'number';
const STYLE_TABLE = 'table';
const STYLE_GRAPH_BAR = 'graph-bar';
const STYLE_GRAPH_SCATTERPLOT = 'graph-scatterplot';
const STYLE_GRAPH_LINE = 'graph-line';
const STYLE_GRAPH_HORIZONTAL_BAR = 'graph-horizontal-bar';
const STYLE_GRAPH_STACKED_BAR = 'graph-stacked-bar';
const STYLE_GRAPH_HORIZONTAL_STACKED_BAR = 'graph-horizontal-stacked-bar';
const STYLE_GRAPH_STACKED_AREA = 'graph-stacked-area';

export default function() {
  const store = this.riotx.get();

  // データ取得中か否か。
  this.isPending = true;
  // レスポンスデータが有効か否か。
  this.isValidData = false;
  // レスポンスデータが不正の時に表示するエラー文言。
  this.alertText = '';
  // レスポンスデータ。
  this.response = null;
  // レスポンスの構造。
  this.schemaObject = null;
  // リクエストパラメータ定義。
  this.parameterObjects = [];
  // 自身に関するアクション群。
  this.selfActions = [];
  // テーブル行に関するアクション群。
  this.rowActions = [];
  // テーブルのrow表示ラベル。
  this.tableLabels = [];
  // テーブルの全column群。
  this.tableColumns = [];
  // filterで選択されたcolumn群。
  this.selectedTableColumns = [];
  // テーブル使用時のprimaryキー。
  this.primaryKey = null;
  // ページング機能ONかどうか。
  this.hasPagination = false;
  // ページング情報。
  this.pagination = {};
  // ページングのサイズ値。
  this.paginationSize = 3;
  // 自動更新間隔。
  this.autoRefreshSec = 0;
  // 現在の検索用リクエストパラメータ値。
  this.currentSearchRequestParameters = ObjectAssign({}, this.opts.entirecurrentsearchrequestparameters || {});
  this.isCurrentSearchRequestParametersEmpty = () => {
    return !keys(this.currentSearchRequestParameters).length;
  };
  // 検索用のParameterObject群を返します。(i.e. ページング用のParameterObjectを取り除く)
  this.getParameterObjectsForSearch = () => {
    return reject(this.parameterObjects || [], parameterObject => {
      if (parameterObject.in !== 'query') {
        return false;
      }
      if (parameterObject.name === 'limit') {
        return true;
      }
      if (parameterObject.name === 'offset') {
        return true;
      }
      return false;
    });
  };

  // コンポーネントにrenderするRiotタグ名。
  this.childComponentName = null;
  switch (this.opts.component.style) {
  case STYLE_NUMBER:
    this.childComponentName = 'viron-component-number';
    break;
  case STYLE_TABLE:
    this.childComponentName = 'viron-component-table';
    break;
  case STYLE_GRAPH_BAR:
    this.childComponentName = 'viron-component-graph-bar';
    break;
  case STYLE_GRAPH_SCATTERPLOT:
    this.childComponentName = 'viron-component-graph-scatterplot';
    break;
  case STYLE_GRAPH_LINE:
    this.childComponentName = 'viron-component-graph-line';
    break;
  case STYLE_GRAPH_HORIZONTAL_BAR:
    this.childComponentName = 'viron-component-graph-horizontal-bar';
    break;
  case STYLE_GRAPH_STACKED_BAR:
    this.childComponentName = 'viron-component-graph-stacked-bar';
    break;
  case STYLE_GRAPH_HORIZONTAL_STACKED_BAR:
    this.childComponentName = 'viron-component-graph-horizontal-stacked-bar';
    break;
  case STYLE_GRAPH_STACKED_AREA:
    this.childComponentName = 'viron-component-graph-stacked-area';
    break;
  default:
    this.isValidData = false;
    this.alertText = `"${this.opts.component.style}"はサポートされていないstyleです。サポートされているstyleを使用して下さい。`;
    break;
  }

  // コンポーネントを更新するための関数。
  // 子コンポーネントに渡されます。
  this.updater = (requestParameters = {}) => {
    this.isPending = true;
    this.update();

    this.currentSearchRequestParameters = objectReject(ObjectAssign(this.currentSearchRequestParameters, requestParameters), val => {
      return isUndefined(val);
    });
    return Promise
      .resolve()
      .then(() => new Promise(resolve => {
        // 通信が速すぎると見た目がチカチカするので、意図的に通信を遅らせる。
        setTimeout(() => {
          resolve();
        }, 300);
      }))
      .then(() => store.action('components.get', this._riot_id, this.opts.component, this.currentSearchRequestParameters))
      .catch(err => {
        // 401 = 認証エラー
        // 通常エラーと認証エラーで処理を振り分ける。
        if (err.status !== 401) {
          const api = this.opts.component.api;
          return store.action('modals.add', {
            title: '通信失敗',
            message: `[${api.method.toUpperCase()} ${api.path}]通信に失敗しました。該当するAPIがOAS上に正しく定義されているかご確認下さい。`,
            error: err
          });
        }
        return Promise
          .resolve()
          .then(() => store.action('modals.add', 'viron-message', {
            title: '認証切れ',
            message: '認証が切れました。再度ログインして下さい。'
          }))
          .then(() => {
            this.getRouter().navigateTo('/');
          });
      });
  };

  /**
   * レスポンス内容が正しい形式か確認します。
   * @param {*} response
   */
  this.validateResponse = response => {
    const style = this.opts.component.style;

    if (style === STYLE_NUMBER) {
      if (typeof response !== 'object' || response.value === 'undefined') {
        this.isValidData = false;
        this.alertText = 'レスポンス形式が不正です。正しいレスポンス形式に修正して下さい。';
        return;
      }
    }

    if (style === STYLE_TABLE) {
      if (!Array.isArray(response)) {
        this.isValidData = false;
        this.alertText = 'レスポンス形式が不正です。正しいレスポンス形式に修正して下さい。';
        return;
      }
      if (!response.length) {
        this.isValidData = false;
        this.alertText = 'テーブルが空です。';
        return;
      }
      if (typeof response[0] !== 'object') {
        this.isValidData = false;
        this.alertText = 'レスポンス形式が不正です。正しいレスポンス形式に修正して下さい。';
        return;
      }
    }

    if (contains([
      STYLE_GRAPH_BAR,
      STYLE_GRAPH_SCATTERPLOT,
      STYLE_GRAPH_LINE,
      STYLE_GRAPH_HORIZONTAL_BAR,
      STYLE_GRAPH_STACKED_BAR,
      STYLE_GRAPH_HORIZONTAL_STACKED_BAR,
      STYLE_GRAPH_STACKED_AREA
    ], style)) {
      if (typeof response !== 'object') {
        this.isValidData = false;
        this.alertText = 'レスポンス形式が不正です。正しいレスポンス形式に修正して下さい。';
        return;
      }
      if (!response.data || !response.x || !response.y || !Array.isArray(response.data)) {
        this.isValidData = false;
        this.alertText = 'レスポンス形式が不正です。正しいレスポンス形式に修正して下さい。';
        return;
      }
      if (!response.data.length) {
        this.isValidData = false;
        this.alertText = 'グラフデータが空です。';
        return;
      }
    }

    this.isValidData = true;
    this.alertText = '';
  };

  // 更新ボタンや定期更新で使用される。
  const refresh = () => {
    Promise
      .resolve()
      .then(() => {
        // 更新時に高さが変わらないように。
        const rect = this.refs.body.getBoundingClientRect();
        this.refs.body.style.height = `${rect.height}px`;
      })
      .then(() => this.updater())
      .then(() => {
        this.refs.body.style.height = '';
      });
  };

  // 自動更新機能関連。
  let autoRefreshIntervalId = null;
  const activateAutoRefresh = () => {
    if (!this.autoRefreshSec) {
      return;
    }
    if (autoRefreshIntervalId) {
      return;
    }
    autoRefreshIntervalId = window.setInterval(() => {
      refresh();
    }, this.autoRefreshSec * 1000);
  };
  const inactivateAutoRefresh = () => {
    window.clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  };

  this.on('mount', () => {
    // TODO: GETリクエストに必須パラメータが存在するケースへの対応。
    this.updater();
  }).on('update', () => {
    this.currentSearchRequestParameters = ObjectAssign(this.currentSearchRequestParameters, this.opts.entirecurrentsearchrequestparameters || {});
  }).on('unmount', () => {
    inactivateAutoRefresh();
    store.action('components.remove', this._riot_id);
  });

  this.listen(getComponentStateName(this._riot_id), () => {
    this.isPending = false;
    this.response = store.getter('components.response', this._riot_id);
    this.schemaObject = store.getter('components.schemaObject', this._riot_id);
    this.parameterObjects = store.getter('components.parameterObjects', this._riot_id);
    this.selfActions = store.getter('components.selfActions', this._riot_id);
    this.rowActions = store.getter('components.rowActions', this._riot_id);
    this.hasPagination = store.getter('components.hasPagination', this._riot_id);
    this.autoRefreshSec = store.getter('components.autoRefreshSec', this._riot_id);
    this.pagination = store.getter('components.pagination', this._riot_id);
    this.primaryKey = store.getter('components.primaryKey', this._riot_id);
    this.tableLabels = store.getter('components.tableLabels', this._riot_id);
    this.tableColumns = store.getter('components.tableColumns', this._riot_id);
    this.validateResponse(this.response);
    activateAutoRefresh();
    this.update();
  });

  this.handleRefreshButtonClick = () => {
    refresh();
  };

  this.handleFilterButtonClick = () => {
    if (this.isPending) {
      return;
    }
    Promise
      .resolve()
      .then(() => store.action('modals.add', 'viron-component-filter', {
        tableColumns: this.tableColumns,
        selectedTableColumns: this.selectedTableColumns,
        onComplete: newSelectedTableColumns => {
          this.selectedTableColumns = newSelectedTableColumns;
          this.update();
        }
      }))
      .catch(err => store.action('modals.add', 'viron-message', {
        error: err
      }));
  };

  this.handleSearchButtonClick = () => {
    if (this.isPending) {
      return;
    }

    // ページングに使用するparamerは取り除く。
    const escapedParameterObjects = this.getParameterObjectsForSearch();

    // 検索用のparameterObjectが存在しない場合は何もしない。
    if (!escapedParameterObjects.length) {
      return;
    }

    Promise
      .resolve()
      .then(() => store.action('modals.add', 'viron-component-search', {
        parameterObjects: escapedParameterObjects,
        initialParameters: ObjectAssign({}, this.currentSearchRequestParameters),
        onComplete: parameters => {
          this.opts.entirecurrentsearchrequestparametersresetter();
          this.updater(parameters);
        }
      }))
      .catch(err => store.action('modals.add', 'viron-message', {
        error: err
      }));
  };

  this.handlePaginationChange = page => {
    const paging = this.currentPaging = {
      limit: this.pagination.size,
      offset: (page - 1) * this.pagination.size
    };
    this.updater(paging);
  };
}