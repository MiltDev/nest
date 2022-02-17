import {EntityManager, Repository} from 'typeorm';
import {SearchHelper} from '../../usecases/helpers/SearchHelper';
import {ICrudRepository} from '../../usecases/interfaces/ICrudRepository';
import {SearchInputDto} from '../../usecases/dtos/SearchInputDto';
import {SearchResultDto} from '../../usecases/dtos/SearchResultDto';
import SearchQuery from '../../usecases/base/SearchQuery';
import {DataMapperHelper} from '../../usecases/helpers/DataMapperHelper';
import {SelectQueryBuilder} from 'typeorm/query-builder/SelectQueryBuilder';
import {ICondition} from '../../usecases/helpers/ConditionHelper';

/**
 * Generic CRUD repository
 */
export class CrudRepository<TModel> implements ICrudRepository<TModel> {
    /**
     * Table primary key
     */
    public primaryKey: string = 'id';

    /**
     * TypeORM repository instance
     */
    public dbRepository: Repository<any>;

    protected modelClass;

    /**
     * Manually initialize database repository (without extend class CrudRepository)
     * @param dbRepository
     * @param modelClass
     */
    public init(dbRepository: Repository<any>, modelClass: any) {
        this.dbRepository = dbRepository;
        this.modelClass = modelClass;
    }

    /**
     * Search items with pagination, filters and sorting
     * @param dto
     * @param searchQuery
     */
    async search(dto: SearchInputDto, searchQuery: SearchQuery): Promise<SearchResultDto<TModel>> {
        const result = await SearchHelper.search<TModel>(
            this.dbRepository,
            dto,
            searchQuery,
            null
        );
        result.items = result.items.map(item => this.entityToModel(item));
        return result;
    }

    /**
     * Find item by condition
     * @param conditionOrQuery
     */
    async findOne(conditionOrQuery: ICondition | SearchQuery): Promise<TModel | null> {
        const dbQuery = this.createQueryBuilder(conditionOrQuery);

        const row = await dbQuery.getOne();
        return row ? this.entityToModel(row) : null;
    }

    /**
     * Find item by condition
     * @param conditionOrQuery
     */
    async findMany(conditionOrQuery: ICondition | SearchQuery): Promise<TModel[]> {
        const dbQuery = this.createQueryBuilder(conditionOrQuery);

        const rows = await dbQuery.getMany();
        return rows.map(row => this.entityToModel(row));
    }

    /**
     * Create db query builder for findOne() and findMany() methods
     * @param conditionOrQuery
     * @protected
     */
    protected createQueryBuilder(conditionOrQuery: ICondition | SearchQuery): SelectQueryBuilder<any> {
        let searchQuery = conditionOrQuery as SearchQuery;
        if (!(conditionOrQuery instanceof SearchQuery)) {
            searchQuery = new SearchQuery();
            searchQuery.condition = conditionOrQuery;
        }

        const dbQuery = this.dbRepository.createQueryBuilder();
        SearchQuery.prepare(this.dbRepository, dbQuery, searchQuery);

        return dbQuery;
    }

    /**
     * Create item
     * @param model
     * @param transactionHandler
     */
    async create(model: TModel, transactionHandler?: (callback) => Promise<void>): Promise<TModel> {
        model[this.primaryKey] = undefined;
        return this.save(model, transactionHandler);
    }

    /**
     * Update item
     * @param id
     * @param model
     * @param transactionHandler
     */
    async update(id: number, model: TModel, transactionHandler?: (callback) => Promise<void>): Promise<TModel> {
        model[this.primaryKey] = id;
        return this.save(model, transactionHandler);
    }

    /**
     * Create or update item
     * @param model
     * @param transactionHandler
     */
    async save(model: TModel, transactionHandler?: (callback) => Promise<void>): Promise<TModel> {
        if (transactionHandler) {
            await this.dbRepository.manager.transaction(async (manager) => {
                await transactionHandler(async () => {
                    await this.saveInternal(manager, model);
                });
            });
        } else {
            await this.saveInternal(this.dbRepository.manager, model);
        }

        return model;
    }

    /**
     * Internal save method for overwrite in project
     * @param manager
     * @param nextModel
     */
    async saveInternal(manager: EntityManager, nextModel: TModel) {
        const entity = await manager.save(this.modelToEntity(nextModel));
        DataMapperHelper.applyChangesToModel(nextModel, entity);
    }

    /**
     * Remove item
     * @param id
     * @param transactionHandler
     */
    async remove(id: number, transactionHandler?: (callback) => Promise<void>): Promise<void> {
        if (transactionHandler) {
            await this.dbRepository.manager.transaction(async (manager) => {
                await transactionHandler(async () => {
                    await this.removeInternal(manager, id);
                });
            });
        } else {
            await this.removeInternal(this.dbRepository.manager, id);
        }
    }

    /**
     * Internal remove method for overwrite in project
     * @param manager
     * @param id
     */
    async removeInternal(manager: EntityManager, id: number) {
        await manager.remove(this.dbRepository.create({id}));
    }

    /**
     * Mapping model to entity object
     * @param model
     * @protected
     */
    protected modelToEntity(model): any {
        return DataMapperHelper.modelToEntity(this.dbRepository.manager.connection, model);
    }

    /**
     * Mapping entity object to model
     * @param obj
     * @protected
     */
    protected entityToModel(obj: any): TModel {
        if (!this.modelClass) {
            throw new Error('Property modelClass is not set in repository: ' + this.constructor.name);
        }
        return DataMapperHelper.anyToModel(obj, this.modelClass);
    }
}
